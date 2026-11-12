import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Review } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Page } from '../products/product.types';
import { CreateReviewDto } from './dto/create-review.dto';

export interface ReviewView {
  id: string;
  rating: number;
  authorName: string;
  title: string | null;
  body: string;
  createdAt: string;
}

const toView = (r: Review): ReviewView => ({
  id: r.id,
  rating: r.rating,
  authorName: r.authorName,
  title: r.title,
  body: r.body,
  createdAt: r.createdAt.toISOString(),
});

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(sku: string, page = 1, pageSize = 10): Promise<Page<ReviewView>> {
    const product = await this.prisma.product.findUnique({
      where: { sku: normalizeSku(sku) },
      select: { id: true },
    });
    if (!product) throw new NotFoundException(`Product ${sku} not found`);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { productId: product.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.review.count({ where: { productId: product.id } }),
    ]);
    return { items: items.map(toView), total, page, pageSize };
  }

  /**
   * Insert the review and refresh the product's rating aggregate atomically.
   * The product row is locked first (FOR UPDATE), so concurrent reviews of the
   * same product are serialised and each recount sees all committed reviews.
   * Recounting (instead of incrementally adjusting an average) cannot drift.
   */
  async create(sku: string, dto: CreateReviewDto): Promise<ReviewView> {
    return this.prisma.$transaction(async (tx) => {
      const [product] = await tx.$queryRaw<{ id: number; delisted: boolean }[]>`
        SELECT id, delisted_at IS NOT NULL AS delisted
        FROM products WHERE sku = ${normalizeSku(sku)} FOR UPDATE`;
      if (!product) throw new NotFoundException(`Product ${sku} not found`);
      if (product.delisted) {
        throw new ConflictException('This product is no longer in the catalogue.');
      }

      const review = await tx.review.create({
        data: {
          productId: product.id,
          rating: dto.rating,
          authorName: dto.authorName,
          title: dto.title ?? null,
          body: dto.body,
        },
      });

      const stats = await tx.review.aggregate({
        where: { productId: product.id },
        _count: { _all: true },
        _avg: { rating: true },
      });
      await tx.product.update({
        where: { id: product.id },
        data: { reviewCount: stats._count._all, ratingAverage: stats._avg.rating },
      });

      return toView(review);
    });
  }
}

function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase();
}
