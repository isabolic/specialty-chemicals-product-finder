import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PaginationQuery } from '../common/pagination.query';
import { Page } from '../products/product.types';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewView, ReviewsService } from './reviews.service';

@Controller('products/:sku/reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  list(@Param('sku') sku: string, @Query() query: PaginationQuery): Promise<Page<ReviewView>> {
    return this.reviews.list(sku, query.page, query.pageSize);
  }

  /**
   * No authentication in v1, so the write path is rate-limited per client IP
   * as a basic guard against spam and accidental double submits.
   */
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: () => Number(process.env.REVIEW_RATE_LIMIT ?? 5), ttl: 60_000 } })
  create(@Param('sku') sku: string, @Body() dto: CreateReviewDto): Promise<ReviewView> {
    return this.reviews.create(sku, dto);
  }
}
