import { parse } from 'csv-parse/sync';
import { CSV_COLUMNS, RawProductRow } from './normalize';

export class InvalidExportError extends Error {}

/**
 * Parse the PIM CSV. Fails loudly on a structurally broken file (missing
 * columns) instead of importing garbage: a half-read export would otherwise
 * delist most of the catalogue.
 */
export function parseProductCsv(content: string): RawProductRow[] {
  let records: Record<string, string>[];
  try {
    records = parse(content, {
      bom: true,
      columns: (header: string[]) => header.map((h) => h.trim().toLowerCase()),
      skip_empty_lines: true,
      relax_column_count: false,
    });
  } catch (error) {
    throw new InvalidExportError(`CSV could not be parsed: ${(error as Error).message}`);
  }

  if (records.length > 0) {
    const missing = CSV_COLUMNS.filter((c) => !(c in records[0]));
    if (missing.length > 0) {
      throw new InvalidExportError(`CSV is missing columns: ${missing.join(', ')}`);
    }
  }
  return records as RawProductRow[];
}
