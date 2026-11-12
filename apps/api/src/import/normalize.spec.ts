import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  RawProductRow,
  normalizeExport,
  parseCertifications,
  parseLaunchYear,
  parseStatus,
} from './normalize';
import { InvalidExportError, parseProductCsv } from './parse-csv';

const row = (overrides: RawProductRow = {}): RawProductRow => ({
  sku: 'P-1',
  name: 'Quorin SF 470',
  chemical_name: 'Sodium Laureth Sulfate',
  function: 'Surfactant',
  application_area: 'Home Care',
  region: 'EMEA',
  certifications: 'Kosher|Vegan',
  status: 'Active',
  launch_year: '2012',
  description: 'A surfactant.',
  ...overrides,
});

describe('parseStatus', () => {
  it.each([
    ['Active', 'ACTIVE'],
    ['active', 'ACTIVE'],
    ['ACTIVE', 'ACTIVE'],
    [' Active ', 'ACTIVE'],
    ['Phase-out', 'PHASE_OUT'],
    ['Phase out', 'PHASE_OUT'],
    ['Discontinued', 'DISCONTINUED'],
  ])('maps %p to %s', (input, expected) => {
    expect(parseStatus(input)).toBe(expected);
  });

  it.each(['', 'Unknown', 'Retired', undefined])('rejects %p', (input) => {
    expect(parseStatus(input)).toBeNull();
  });
});

describe('parseCertifications', () => {
  it('splits, trims, de-duplicates and sorts', () => {
    expect(parseCertifications(' Vegan | Kosher|Vegan||')).toEqual(['Kosher', 'Vegan']);
  });

  it('returns an empty list for an empty cell', () => {
    expect(parseCertifications('')).toEqual([]);
  });
});

describe('parseLaunchYear', () => {
  it.each([
    ['2012', 2012],
    ['n/a', null],
    ['', null],
    ['12', null],
    ['1850', null],
    ['2031', null],
  ])('parses %p as %p', (input, expected) => {
    expect(parseLaunchYear(input, 2026)).toBe(expected);
  });
});

describe('normalizeExport', () => {
  it('trims whitespace in every field', () => {
    const { products } = normalizeExport([row({ name: '  Puraxin SF 120 ', region: ' EMEA ' })]);
    expect(products[0]).toMatchObject({ name: 'Puraxin SF 120', region: 'EMEA' });
  });

  it('falls back to the SKU when the name is empty and warns', () => {
    const { products, issues } = normalizeExport([row({ name: '' })]);
    expect(products[0].name).toBe('P-1');
    expect(issues).toEqual([expect.objectContaining({ code: 'MISSING_NAME', severity: 'warning' })]);
  });

  it('stores an invalid launch year as null and warns', () => {
    const { products, issues } = normalizeExport([row({ launch_year: 'n/a' })]);
    expect(products[0].launchYear).toBeNull();
    expect(issues[0].code).toBe('INVALID_LAUNCH_YEAR');
  });

  it('does not warn about an empty launch year', () => {
    expect(normalizeExport([row({ launch_year: '' })]).issues).toEqual([]);
  });

  it('rejects rows with an unknown status but still counts the SKU as seen', () => {
    const result = normalizeExport([row({ status: 'Retired' })]);
    expect(result.products).toEqual([]);
    expect(result.rejected).toBe(1);
    expect(result.seenSkus.has('P-1')).toBe(true);
    expect(result.issues[0]).toMatchObject({ code: 'INVALID_STATUS', severity: 'error' });
  });

  it('rejects rows without a SKU', () => {
    const result = normalizeExport([row({ sku: '  ' })]);
    expect(result.products).toEqual([]);
    expect(result.issues[0].code).toBe('MISSING_SKU');
  });

  it('reports line numbers relative to the file (header = line 1)', () => {
    const { issues } = normalizeExport([row(), row({ sku: 'P-2', launch_year: 'x' })]);
    expect(issues[0].line).toBe(3);
  });

  it('keeps the last occurrence of a duplicate SKU and flags conflicts', () => {
    const { products, issues } = normalizeExport([
      row({ status: 'Active' }),
      row({ status: 'Discontinued' }),
    ]);
    expect(products).toHaveLength(1);
    expect(products[0].status).toBe('DISCONTINUED');
    expect(issues[0]).toMatchObject({ code: 'CONFLICTING_DUPLICATE_SKU', line: 3 });
  });

  it('flags identical duplicates separately from conflicting ones', () => {
    const { products, issues } = normalizeExport([row(), row()]);
    expect(products).toHaveLength(1);
    expect(issues[0].code).toBe('DUPLICATE_SKU');
  });

  it('normalises SKU case so duplicates are detected', () => {
    const { products } = normalizeExport([row({ sku: 'p-1' }), row({ sku: 'P-1 ' })]);
    expect(products).toHaveLength(1);
  });
});

describe('parseProductCsv', () => {
  it('fails on a file with missing columns', () => {
    expect(() => parseProductCsv('sku,name\nP-1,Foo\n')).toThrow(InvalidExportError);
  });

  it('handles a BOM and quoted commas', () => {
    const csv =
      '﻿sku,name,chemical_name,function,application_area,region,certifications,status,launch_year,description\n' +
      'P-1,Foo,Bar,Baz,Home Care,EMEA,,Active,2020,"Thick, clear gel"\n';
    expect(parseProductCsv(csv)[0]).toMatchObject({ sku: 'P-1', description: 'Thick, clear gel' });
  });
});

/** Guards against regressions on the real sample export. */
describe('sample export data/products.csv', () => {
  const csv = readFileSync(resolve(__dirname, '../../../../data/products.csv'), 'utf8');
  const result = normalizeExport(parseProductCsv(csv), { currentYear: 2026 });

  it('imports 200 unique products out of 202 rows', () => {
    expect(result.rowsRead).toBe(202);
    expect(result.products).toHaveLength(200);
    expect(result.rejected).toBe(0);
  });

  it('resolves the conflicting duplicate P-10151 to the last row (Discontinued)', () => {
    expect(result.products.find((p) => p.sku === 'P-10151')?.status).toBe('DISCONTINUED');
  });

  it('only produces known statuses', () => {
    const statuses = new Set(result.products.map((p) => p.status));
    expect([...statuses].sort()).toEqual(['ACTIVE', 'DISCONTINUED', 'PHASE_OUT']);
  });

  it('reports exactly the known data-quality issues', () => {
    expect(result.issues.map((i) => `${i.sku}:${i.code}`).sort()).toEqual([
      'P-10013:DUPLICATE_SKU',
      'P-10105:INVALID_LAUNCH_YEAR',
      'P-10119:MISSING_NAME',
      'P-10151:CONFLICTING_DUPLICATE_SKU',
    ]);
  });
});
