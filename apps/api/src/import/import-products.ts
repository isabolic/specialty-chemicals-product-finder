import { Prisma, PrismaClient } from '../generated/prisma/client';
import { ImportIssue, NormalizedExport, NormalizedProduct } from './normalize';

export interface ImportOptions {
  source: string;
  /** Report what would change, write nothing (except the audit row). */
  dryRun?: boolean;
  /** Bypass the mass-delisting safety guard. */
  force?: boolean;
  /** Abort if more than this share of listed products would be delisted. */
  maxDelistRatio?: number;
}

export interface ImportSummary {
  runId: number;
  rowsRead: number;
  rejected: number;
  created: number;
  updated: number;
  unchanged: number;
  delisted: number;
  issues: ImportIssue[];
  dryRun: boolean;
}

export class ImportAbortedError extends Error {}

/** Rows per INSERT statement; keeps parameters small at 50k products. */
const CHUNK_SIZE = 2000;
/** Below this catalogue size the ratio guard is too noisy to be useful. */
const GUARD_MIN_LISTED = 20;
/** Arbitrary but stable key so two imports never run concurrently. */
const IMPORT_LOCK_KEY = 717_001;

class DryRunRollback extends Error {}

/**
 * Write a normalised export to the database. Idempotent:
 * - products are upserted by SKU, and only rows whose data changed are touched;
 * - products missing from the export are soft-delisted, never deleted;
 * - reviews and review aggregates are never written here.
 * Everything happens in one transaction, so a failed run changes nothing.
 */
export async function importProducts(
  prisma: PrismaClient,
  data: NormalizedExport,
  options: ImportOptions,
): Promise<ImportSummary> {
  const { source, dryRun = false, force = false, maxDelistRatio = 0.5 } = options;
  const run = await prisma.importRun.create({
    data: { source, rowsRead: data.rowsRead, rejected: data.rejected },
  });
  const summary: ImportSummary = {
    runId: run.id,
    rowsRead: data.rowsRead,
    rejected: data.rejected,
    created: 0,
    updated: 0,
    unchanged: 0,
    delisted: 0,
    issues: data.issues,
    dryRun,
  };

  try {
    if (data.products.length === 0) {
      throw new ImportAbortedError('Export contains no valid products; nothing imported.');
    }

    await prisma
      .$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${IMPORT_LOCK_KEY})`;

          const seen = [...data.seenSkus];
          const [{ listed, missing }] = await tx.$queryRaw<
            { listed: number; missing: number }[]
          >`
            SELECT count(*)::int AS listed,
                   count(*) FILTER (WHERE NOT (sku = ANY(${seen}::text[])))::int AS missing
            FROM products WHERE delisted_at IS NULL`;

          if (
            !force &&
            listed >= GUARD_MIN_LISTED &&
            missing > listed * maxDelistRatio
          ) {
            throw new ImportAbortedError(
              `Export would delist ${missing} of ${listed} listed products ` +
                `(> ${Math.round(maxDelistRatio * 100)}%). This usually means a ` +
                `truncated export. Re-run with --force if it is intended.`,
            );
          }

          for (let i = 0; i < data.products.length; i += CHUNK_SIZE) {
            const chunk = data.products.slice(i, i + CHUNK_SIZE);
            const written = await upsertChunk(tx, chunk);
            summary.created += written.filter((r) => r.inserted).length;
            summary.updated += written.filter((r) => !r.inserted).length;
          }
          summary.unchanged = data.products.length - summary.created - summary.updated;

          summary.delisted = await tx.$executeRaw`
            UPDATE products SET delisted_at = now(), updated_at = now()
            WHERE delisted_at IS NULL AND NOT (sku = ANY(${seen}::text[]))`;

          if (dryRun) throw new DryRunRollback();
        },
        { timeout: 120_000, maxWait: 10_000 },
      )
      .catch((error: unknown) => {
        if (!(error instanceof DryRunRollback)) throw error;
      });

    await finishRun(prisma, run.id, dryRun ? 'dry-run' : 'succeeded', summary);
    return summary;
  } catch (error) {
    summary.issues = [
      ...summary.issues,
      { line: 0, severity: 'error', code: 'IMPORT_ABORTED', message: (error as Error).message },
    ];
    await finishRun(prisma, run.id, 'failed', summary);
    throw error;
  }
}

/**
 * One set-based statement per chunk. `IS DISTINCT FROM` skips rows whose data
 * is identical, so re-running the same export performs no writes and
 * `updated_at` stays meaningful. `xmax = 0` identifies freshly inserted rows.
 */
async function upsertChunk(
  tx: Prisma.TransactionClient,
  chunk: NormalizedProduct[],
): Promise<{ inserted: boolean }[]> {
  const payload = JSON.stringify(chunk);
  return tx.$queryRaw<{ inserted: boolean }[]>`
    INSERT INTO products AS p (
      sku, name, chemical_name, "function", application_area, region,
      certifications, status, launch_year, description, delisted_at, updated_at
    )
    SELECT r.sku, r.name, r."chemicalName", r."function", r."applicationArea", r.region,
           ARRAY(SELECT jsonb_array_elements_text(r.certifications)),
           r.status::product_status, r."launchYear", r.description, NULL, now()
    FROM jsonb_to_recordset(${payload}::jsonb) AS r(
      sku text, name text, "chemicalName" text, "function" text, "applicationArea" text,
      region text, certifications jsonb, status text, "launchYear" int, description text
    )
    ON CONFLICT (sku) DO UPDATE SET
      name = EXCLUDED.name,
      chemical_name = EXCLUDED.chemical_name,
      "function" = EXCLUDED."function",
      application_area = EXCLUDED.application_area,
      region = EXCLUDED.region,
      certifications = EXCLUDED.certifications,
      status = EXCLUDED.status,
      launch_year = EXCLUDED.launch_year,
      description = EXCLUDED.description,
      delisted_at = NULL,
      updated_at = now()
    WHERE (p.name, p.chemical_name, p."function", p.application_area, p.region,
           p.certifications, p.status, p.launch_year, p.description, p.delisted_at)
      IS DISTINCT FROM
          (EXCLUDED.name, EXCLUDED.chemical_name, EXCLUDED."function", EXCLUDED.application_area,
           EXCLUDED.region, EXCLUDED.certifications, EXCLUDED.status, EXCLUDED.launch_year,
           EXCLUDED.description, NULL::timestamp)
    RETURNING (xmax = 0) AS inserted`;
}

async function finishRun(
  prisma: PrismaClient,
  id: number,
  status: string,
  s: ImportSummary,
): Promise<void> {
  await prisma.importRun.update({
    where: { id },
    data: {
      status,
      finishedAt: new Date(),
      created: s.created,
      updated: s.updated,
      unchanged: s.unchanged,
      delisted: s.delisted,
      issues: s.issues as unknown as Prisma.InputJsonValue,
    },
  });
}
