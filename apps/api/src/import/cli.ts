import '../load-env';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPrismaClient } from '../prisma/create-prisma-client';
import { ImportAbortedError, importProducts } from './import-products';
import { normalizeExport } from './normalize';
import { InvalidExportError, parseProductCsv } from './parse-csv';

const USAGE = 'Usage: import <file.csv> [--dry-run] [--force]';

async function main(argv: string[]): Promise<number> {
  const flags = new Set(argv.filter((a) => a.startsWith('--')));
  const [file] = argv.filter((a) => !a.startsWith('--'));
  if (!file) {
    console.error(USAGE);
    return 2;
  }

  const path = resolve(file);
  const data = normalizeExport(parseProductCsv(await readFile(path, 'utf8')));
  const prisma = createPrismaClient();
  try {
    const s = await importProducts(prisma, data, {
      source: path,
      dryRun: flags.has('--dry-run'),
      force: flags.has('--force'),
    });
    for (const i of s.issues) {
      console.warn(`[${i.severity}] line ${i.line}${i.sku ? ` ${i.sku}` : ''} ${i.code}: ${i.message}`);
    }
    console.log(
      `${s.dryRun ? '[dry-run] ' : ''}Import #${s.runId}: ${s.rowsRead} rows, ` +
        `${s.created} created, ${s.updated} updated, ${s.unchanged} unchanged, ` +
        `${s.delisted} delisted, ${s.rejected} rejected`,
    );
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    const known = error instanceof ImportAbortedError || error instanceof InvalidExportError;
    console.error(known ? `Import aborted: ${(error as Error).message}` : error);
    process.exit(1);
  });
