/**
 * Pure normalisation of a PIM export. No I/O, no database: everything the
 * import decides about the *data* lives here so it can be unit-tested
 * exhaustively against the quirks seen in real exports.
 */

export type ProductStatus = 'ACTIVE' | 'PHASE_OUT' | 'DISCONTINUED';

/** One row as it comes out of the CSV parser (all strings, possibly missing). */
export type RawProductRow = Partial<Record<CsvColumn, string>>;

export const CSV_COLUMNS = [
  'sku',
  'name',
  'chemical_name',
  'function',
  'application_area',
  'region',
  'certifications',
  'status',
  'launch_year',
  'description',
] as const;
export type CsvColumn = (typeof CSV_COLUMNS)[number];

export interface NormalizedProduct {
  sku: string;
  name: string;
  chemicalName: string;
  function: string;
  applicationArea: string;
  region: string;
  certifications: string[];
  status: ProductStatus;
  launchYear: number | null;
  description: string;
}

export type IssueSeverity = 'warning' | 'error';

export interface ImportIssue {
  /** 1-based line number in the source file (header is line 1). */
  line: number;
  sku?: string;
  severity: IssueSeverity;
  code: string;
  message: string;
}

export interface NormalizedExport {
  products: NormalizedProduct[];
  /**
   * Every SKU present in the file, including rows rejected for bad data.
   * Used for delisting: a product with a broken row is *not* missing from
   * the export, so it must not be delisted, only left unchanged.
   */
  seenSkus: Set<string>;
  issues: ImportIssue[];
  rowsRead: number;
  rejected: number;
}

const STATUS_ALIASES: Record<string, ProductStatus> = {
  active: 'ACTIVE',
  'phase-out': 'PHASE_OUT',
  'phase out': 'PHASE_OUT',
  phaseout: 'PHASE_OUT',
  'phase_out': 'PHASE_OUT',
  discontinued: 'DISCONTINUED',
};

const MIN_LAUNCH_YEAR = 1900;

/** Collapse internal whitespace and trim. */
export function cleanText(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export function parseStatus(value: string | undefined): ProductStatus | null {
  return STATUS_ALIASES[cleanText(value).toLowerCase()] ?? null;
}

export function parseCertifications(value: string | undefined): string[] {
  const items = (value ?? '')
    .split('|')
    .map((c) => cleanText(c))
    .filter((c) => c.length > 0);
  return [...new Set(items)].sort((a, b) => a.localeCompare(b));
}

export function parseLaunchYear(
  value: string | undefined,
  currentYear: number,
): number | null {
  const text = cleanText(value);
  if (!/^\d{4}$/.test(text)) return null;
  const year = Number(text);
  return year >= MIN_LAUNCH_YEAR && year <= currentYear + 1 ? year : null;
}

type RowResult =
  | { ok: true; product: NormalizedProduct; issues: ImportIssue[] }
  | { ok: false; sku?: string; issues: ImportIssue[] };

export function normalizeRow(
  raw: RawProductRow,
  line: number,
  currentYear: number,
): RowResult {
  const issues: ImportIssue[] = [];
  const sku = cleanText(raw.sku).toUpperCase();
  const issue = (severity: IssueSeverity, code: string, message: string) =>
    issues.push({ line, sku: sku || undefined, severity, code, message });

  if (!sku) {
    issue('error', 'MISSING_SKU', 'Row has no SKU and cannot be matched.');
    return { ok: false, issues };
  }

  const status = parseStatus(raw.status);
  if (!status) {
    // Guessing a status could show a discontinued product as available,
    // which is exactly the problem the Product Finder is meant to solve.
    issue(
      'error',
      'INVALID_STATUS',
      `Unknown status "${cleanText(raw.status)}"; row skipped, existing data kept.`,
    );
    return { ok: false, sku, issues };
  }

  const chemicalName = cleanText(raw.chemical_name);
  let name = cleanText(raw.name);
  if (!name) {
    // Keep the product findable, but don't borrow chemical_name: customers
    // would read it as the trade name. The SKU is an honest placeholder the
    // PIM team recognises, and the warning lands in import_runs for them.
    name = sku;
    issue('warning', 'MISSING_NAME', 'Product name is empty; using SKU as name.');
  }

  const launchYearRaw = cleanText(raw.launch_year);
  const launchYear = parseLaunchYear(launchYearRaw, currentYear);
  if (launchYearRaw && launchYear === null) {
    issue('warning', 'INVALID_LAUNCH_YEAR', `Launch year "${launchYearRaw}" ignored.`);
  }

  for (const column of ['function', 'application_area', 'region'] as const) {
    if (!cleanText(raw[column])) {
      issue('warning', 'MISSING_FIELD', `Column "${column}" is empty.`);
    }
  }

  return {
    ok: true,
    issues,
    product: {
      sku,
      name,
      chemicalName,
      function: cleanText(raw.function),
      applicationArea: cleanText(raw.application_area),
      region: cleanText(raw.region),
      certifications: parseCertifications(raw.certifications),
      status,
      launchYear,
      description: cleanText(raw.description),
    },
  };
}

function sameProduct(a: NormalizedProduct, b: NormalizedProduct): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Normalise a whole export. Duplicate SKUs: the last occurrence wins
 * (exports are typically appended chronologically); conflicting duplicates
 * are reported so the PIM team can fix the source.
 */
export function normalizeExport(
  rows: RawProductRow[],
  options: { currentYear?: number } = {},
): NormalizedExport {
  const currentYear = options.currentYear ?? new Date().getFullYear();
  const bySku = new Map<string, { product: NormalizedProduct; line: number }>();
  const seenSkus = new Set<string>();
  const issues: ImportIssue[] = [];
  let rejected = 0;

  rows.forEach((raw, index) => {
    const line = index + 2; // +1 for 1-based, +1 for the header row
    const result = normalizeRow(raw, line, currentYear);
    issues.push(...result.issues);

    if (!result.ok) {
      rejected++;
      if (result.sku) seenSkus.add(result.sku);
      return;
    }

    const { product } = result;
    seenSkus.add(product.sku);
    const previous = bySku.get(product.sku);
    if (previous) {
      const conflicting = !sameProduct(previous.product, product);
      issues.push({
        line,
        sku: product.sku,
        severity: 'warning',
        code: conflicting ? 'CONFLICTING_DUPLICATE_SKU' : 'DUPLICATE_SKU',
        message: conflicting
          ? `SKU also on line ${previous.line} with different data; line ${line} wins.`
          : `SKU duplicates line ${previous.line}; ignored.`,
      });
    }
    bySku.set(product.sku, { product, line });
  });

  return {
    products: [...bySku.values()].map((v) => v.product),
    seenSkus,
    issues,
    rowsRead: rows.length,
    rejected,
  };
}
