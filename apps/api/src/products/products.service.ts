import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListProductsQuery, ProductSort } from './dto/list-products.query';
import {
  FilterOption,
  Page,
  ProductDetail,
  ProductFilters,
  ProductSummary,
  toDetail,
  toSummary,
} from './product.types';

export const DEFAULT_PAGE_SIZE = 20;

const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  name: [{ name: 'asc' }],
  '-name': [{ name: 'desc' }],
  newest: [{ launchYear: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
  rating: [
    { ratingAverage: { sort: 'desc', nulls: 'last' } },
    { reviewCount: 'desc' },
    { name: 'asc' },
  ],
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListProductsQuery): Promise<Page<ProductSummary>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const where = this.buildWhere(query);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        // SKU as final tie-breaker keeps pagination stable when sort keys collide.
        orderBy: [...ORDER_BY[query.sort ?? 'name'], { sku: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items: items.map(toSummary), total, page, pageSize };
  }

  /** Delisted products are still returned, so links people shared keep working. */
  async getBySku(sku: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { sku: sku.trim().toUpperCase() },
    });
    if (!product) throw new NotFoundException(`Product ${sku} not found`);
    return toDetail(product);
  }

  /**
   * Filter options with counts over the listed catalogue. Counts are global,
   * not narrowed by the current selection: cheap, cacheable, and good enough
   * for v1 (see DECISIONS.md).
   */
  async filters(): Promise<ProductFilters> {
    const listed: Prisma.ProductWhereInput = { delistedAt: null };
    const count = <K extends 'function' | 'applicationArea' | 'region' | 'status'>(by: K) =>
      this.prisma.product.groupBy({ by: [by], where: listed, _count: { _all: true } });

    const [fn, area, region, status, certification] = await Promise.all([
      count('function'),
      count('applicationArea'),
      count('region'),
      count('status'),
      this.prisma.$queryRaw<FilterOption[]>`
        SELECT c AS value, count(*)::int AS count
        FROM products, unnest(certifications) AS c
        WHERE delisted_at IS NULL
        GROUP BY c`,
    ]);

    const options = (rows: { value: string; count: number }[]) =>
      rows.filter((r) => r.value !== '').sort((a, b) => a.value.localeCompare(b.value));

    return {
      function: options(fn.map((r) => ({ value: r.function, count: r._count._all }))),
      applicationArea: options(area.map((r) => ({ value: r.applicationArea, count: r._count._all }))),
      region: options(region.map((r) => ({ value: r.region, count: r._count._all }))),
      certification: options(certification),
      status: options(status.map((r) => ({ value: r.status, count: r._count._all }))),
    };
  }

  private buildWhere(query: ListProductsQuery): Prisma.ProductWhereInput {
    const and: Prisma.ProductWhereInput[] = [
      { delistedAt: null },
      { status: { in: query.status ?? ['ACTIVE'] } },
    ];
    if (query.function) and.push({ function: { in: query.function } });
    if (query.applicationArea) and.push({ applicationArea: { in: query.applicationArea } });
    if (query.region) and.push({ region: { in: query.region } });
    if (query.certification) and.push({ certifications: { hasEvery: query.certification } });
    if (query.q) {
      // Prisma passes `contains` into ILIKE '%…%' without escaping, so a
      // user typing "%" or "_" would match everything / any character.
      const contains = { contains: escapeLike(query.q), mode: 'insensitive' } as const;
      and.push({
        OR: [
          { name: contains },
          { sku: contains },
          { chemicalName: contains },
          { description: contains },
        ],
      });
    }
    return { AND: and };
  }
}

/** Escape LIKE metacharacters (Postgres' default escape character is "\"). */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}
