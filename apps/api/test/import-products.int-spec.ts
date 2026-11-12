import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '../src/generated/prisma/client';
import { ImportAbortedError, importProducts } from '../src/import/import-products';
import { RawProductRow, normalizeExport } from '../src/import/normalize';
import { parseProductCsv } from '../src/import/parse-csv';
import { createPrismaClient } from '../src/prisma/create-prisma-client';
import { row } from './fixtures';
import { testDatabaseUrl } from './test-db';

const sampleRows = parseProductCsv(
  readFileSync(resolve(__dirname, '../../../data/products.csv'), 'utf8'),
);

describe('importProducts (integration)', () => {
  let prisma: PrismaClient;
  const run = (rows: RawProductRow[], opts: { force?: boolean; dryRun?: boolean } = {}) =>
    importProducts(prisma, normalizeExport(rows), { source: 'test', ...opts });

  beforeAll(() => {
    prisma = createPrismaClient(testDatabaseUrl());
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE reviews, products, import_runs RESTART IDENTITY CASCADE`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('populates an empty database from the sample export', async () => {
    const summary = await run(sampleRows);
    expect(summary).toMatchObject({ created: 200, updated: 0, unchanged: 0, delisted: 0 });
    expect(await prisma.product.count()).toBe(200);
    const p = await prisma.product.findUniqueOrThrow({ where: { sku: 'P-10016' } });
    expect(p.region).toBe('EMEA');
  });

  it('is idempotent: a second run writes nothing', async () => {
    await run(sampleRows);
    const before = await prisma.product.findMany({ orderBy: { sku: 'asc' } });

    const summary = await run(sampleRows);

    expect(summary).toMatchObject({ created: 0, updated: 0, unchanged: 200, delisted: 0 });
    expect(await prisma.product.findMany({ orderBy: { sku: 'asc' } })).toEqual(before);
  });

  it('keeps reviews and their aggregates when the import is re-run', async () => {
    await run(sampleRows);
    const product = await prisma.product.findUniqueOrThrow({ where: { sku: 'P-10001' } });
    await prisma.review.create({
      data: { productId: product.id, rating: 4, authorName: 'Ana', body: 'Works well.' },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { reviewCount: 1, ratingAverage: 4 },
    });

    await run(sampleRows.map((r) => (r.sku === 'P-10001' ? { ...r, name: 'Renamed' } : r)));

    const after = await prisma.product.findUniqueOrThrow({ where: { sku: 'P-10001' } });
    expect(after).toMatchObject({ id: product.id, name: 'Renamed', reviewCount: 1, ratingAverage: 4 });
    expect(await prisma.review.count({ where: { productId: product.id } })).toBe(1);
  });

  it('updates changed products only', async () => {
    await run([row('A'), row('B')]);
    const summary = await run([row('A'), row('B', { status: 'Discontinued' })]);
    expect(summary).toMatchObject({ created: 0, updated: 1, unchanged: 1 });
  });

  it('delists products missing from the export and relists them when they return', async () => {
    await run([row('A'), row('B')]);

    expect(await run([row('A')], { force: true })).toMatchObject({ delisted: 1 });
    expect((await prisma.product.findUniqueOrThrow({ where: { sku: 'B' } })).delistedAt).not.toBeNull();

    expect(await run([row('A'), row('B')])).toMatchObject({ updated: 1 });
    expect((await prisma.product.findUniqueOrThrow({ where: { sku: 'B' } })).delistedAt).toBeNull();
  });

  it('does not delist a product whose row was rejected for bad data', async () => {
    await run([row('A'), row('B')]);
    const summary = await run([row('A'), row('B', { status: '???' })]);
    expect(summary).toMatchObject({ delisted: 0, rejected: 1 });
    expect((await prisma.product.findUniqueOrThrow({ where: { sku: 'B' } })).status).toBe('ACTIVE');
  });

  it('aborts without changes when the export would delist most of the catalogue', async () => {
    await run(sampleRows);
    await expect(run(sampleRows.slice(0, 10))).rejects.toThrow(ImportAbortedError);
    expect(await prisma.product.count({ where: { delistedAt: null } })).toBe(200);
    expect(await prisma.importRun.findFirst({ orderBy: { id: 'desc' } })).toMatchObject({
      status: 'failed',
    });
  });

  it('dry run reports changes but writes nothing', async () => {
    const summary = await run(sampleRows, { dryRun: true });
    expect(summary.created).toBe(200);
    expect(await prisma.product.count()).toBe(0);
  });
});
