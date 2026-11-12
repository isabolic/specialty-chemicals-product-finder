import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { importProducts } from '../src/import/import-products';
import { normalizeExport } from '../src/import/normalize';
import { PrismaService } from '../src/prisma/prisma.service';
import { row } from './fixtures';
import { testDatabaseUrl } from './test-db';

async function createApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return app;
}

const CATALOGUE = [
  row('P-1', { name: 'Alpha Gel', function: 'Rheology Modifier', certifications: 'Halal|Vegan', description: 'Efficient THICKENER for clear gels.' }),
  row('P-2', { name: 'Beta Wash', function: 'Surfactant', region: 'EMEA', certifications: 'Vegan', launch_year: '2024' }),
  row('P-3', { name: 'Gamma Old', status: 'Phase-out' }),
  row('P-4', { name: 'Delta Gone', status: 'Discontinued' }),
  row('P-5', { name: 'Epsilon Delisted' }),
];

describe('HTTP API (integration)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl();
    process.env.REVIEW_RATE_LIMIT = '1000';
    app = await createApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE reviews, products, import_runs RESTART IDENTITY CASCADE`;
    await importProducts(prisma, normalizeExport(CATALOGUE), { source: 'test' });
    await importProducts(prisma, normalizeExport(CATALOGUE.slice(0, 4)), { source: 'test', force: true });
  });

  afterAll(async () => {
    await app.close();
  });

  const skus = (res: request.Response) => res.body.items.map((p: { sku: string }) => p.sku);

  describe('GET /api/products', () => {
    it('lists only active, listed products by default', async () => {
      const res = await http().get('/api/products').expect(200);
      expect(skus(res)).toEqual(['P-1', 'P-2']);
      expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 20 });
    });

    it('includes other statuses on request (case-insensitive, comma or repeated)', async () => {
      const res = await http().get('/api/products?status=active,phase_out&status=DISCONTINUED').expect(200);
      expect(skus(res)).toEqual(['P-1', 'P-2', 'P-4', 'P-3']);
    });

    it('searches name, SKU and description case-insensitively', async () => {
      expect(skus(await http().get('/api/products?q=thickener'))).toEqual(['P-1']);
      expect(skus(await http().get('/api/products?q=p-2'))).toEqual(['P-2']);
    });

    it('treats LIKE wildcards in the search text literally', async () => {
      expect(skus(await http().get('/api/products?q=%25'))).toEqual([]);
      expect(skus(await http().get('/api/products?q=Alpha_Gel'))).toEqual([]);
      expect(skus(await http().get('/api/products?q=Alpha%20Gel'))).toEqual(['P-1']);
    });

    it('ORs values within a filter and ANDs certifications', async () => {
      expect(skus(await http().get('/api/products?function=Surfactant&function=Rheology Modifier'))).toEqual(['P-1', 'P-2']);
      expect(skus(await http().get('/api/products?certification=Vegan&certification=Halal'))).toEqual(['P-1']);
    });

    it('sorts and paginates', async () => {
      const res = await http().get('/api/products?sort=newest&pageSize=1&page=1').expect(200);
      expect(skus(res)).toEqual(['P-2']);
      expect(res.body.total).toBe(2);
    });

    it.each([
      ['pageSize=500', 'pageSize'],
      ['sort=price', 'sort'],
      ['status=retired', 'status'],
      ['unknown=1', 'unknown'],
    ])('rejects invalid query %s', async (qs, field) => {
      const res = await http().get(`/api/products?${qs}`).expect(400);
      expect(JSON.stringify(res.body.message)).toContain(field);
    });
  });

  describe('GET /api/products/:sku', () => {
    it('returns the product, matching the SKU case-insensitively', async () => {
      const res = await http().get('/api/products/p-1').expect(200);
      expect(res.body).toMatchObject({ sku: 'P-1', name: 'Alpha Gel', delisted: false });
      expect(res.body).not.toHaveProperty('id');
    });

    it('still resolves delisted products so shared links keep working', async () => {
      const res = await http().get('/api/products/P-5').expect(200);
      expect(res.body.delisted).toBe(true);
    });

    it('returns 404 for unknown SKUs', async () => {
      await http().get('/api/products/P-404').expect(404);
    });
  });

  describe('GET /api/products/filters', () => {
    it('counts options over listed products only', async () => {
      const res = await http().get('/api/products/filters').expect(200);
      expect(res.body.certification).toEqual([
        { value: 'Halal', count: 1 },
        { value: 'Vegan', count: 4 },
      ]);
      expect(res.body.status).toEqual(
        expect.arrayContaining([{ value: 'ACTIVE', count: 2 }]),
      );
    });
  });

  describe('reviews', () => {
    const review = { rating: 4, authorName: ' Ana ', body: ' Works well in our gel. ' };

    it('creates a review, trims text and updates the product rating', async () => {
      const created = await http().post('/api/products/P-1/reviews').send(review).expect(201);
      expect(created.body).toMatchObject({ rating: 4, authorName: 'Ana', body: 'Works well in our gel.', title: null });

      await http().post('/api/products/P-1/reviews').send({ ...review, rating: 1 }).expect(201);

      const product = await http().get('/api/products/P-1');
      expect(product.body).toMatchObject({ reviewCount: 2, ratingAverage: 2.5 });

      const list = await http().get('/api/products/P-1/reviews').expect(200);
      expect(list.body.total).toBe(2);
      expect(list.body.items[0].rating).toBe(1); // newest first
    });

    it('keeps the aggregate exact under concurrent submissions', async () => {
      await Promise.all(
        [1, 2, 3, 4, 5, 5, 4, 3, 2, 1].map((rating) =>
          http().post('/api/products/P-2/reviews').send({ ...review, rating }).expect(201),
        ),
      );
      const product = await http().get('/api/products/P-2');
      expect(product.body).toMatchObject({ reviewCount: 10, ratingAverage: 3 });
    });

    it.each([
      [{ ...review, rating: 6 }, 'rating'],
      [{ ...review, rating: '5' }, 'rating'],
      [{ ...review, authorName: '   ' }, 'authorName'],
      [{ ...review, body: 'x'.repeat(4001) }, 'body'],
      [{ ...review, productId: 2 }, 'productId'],
    ])('rejects invalid input %#', async (payload, field) => {
      const res = await http().post('/api/products/P-1/reviews').send(payload).expect(400);
      expect(JSON.stringify(res.body.message)).toContain(field);
    });

    it('returns 404 for unknown products and 409 for delisted ones', async () => {
      await http().post('/api/products/P-404/reviews').send(review).expect(404);
      await http().post('/api/products/P-5/reviews').send(review).expect(409);
    });
  });
});

describe('review rate limiting (integration)', () => {
  it('rejects bursts from one client with 429', async () => {
    process.env.DATABASE_URL = testDatabaseUrl();
    process.env.REVIEW_RATE_LIMIT = '2';
    const app = await createApp();
    try {
      // Unknown SKU: exercises the guard without writing data.
      const post = () => request(app.getHttpServer()).post('/api/products/P-404/reviews').send({});
      expect((await post()).status).toBe(400);
      expect((await post()).status).toBe(400);
      expect((await post()).status).toBe(429);
    } finally {
      await app.close();
    }
  });
});
