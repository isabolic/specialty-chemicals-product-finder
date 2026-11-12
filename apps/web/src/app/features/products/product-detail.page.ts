import { DatePipe, Location } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { RatingModule } from 'primeng/rating';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { ProductDetail } from '../../core/api.types';
import { ProductsApi } from '../../core/products-api';
import { shareLink } from '../../shared/share-link';
import { StatusTag } from '../../shared/status-tag';
import { ReviewForm } from './review-form';

const REVIEWS_PAGE_SIZE = 10;

@Component({
  selector: 'app-product-detail-page',
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    ButtonModule,
    MessageModule,
    PaginatorModule,
    RatingModule,
    SkeletonModule,
    TagModule,
    StatusTag,
    ReviewForm,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-detail.page.html',
  styleUrl: './product-detail.page.scss',
})
export class ProductDetailPage {
  private readonly api = inject(ProductsApi);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /** Bound from the `:sku` route parameter. */
  readonly sku = input.required<string>();

  protected readonly reviewsPage = signal(1);
  protected readonly reviewsPageSize = REVIEWS_PAGE_SIZE;
  protected readonly shareFeedback = signal<string | null>(null);

  protected readonly product = rxResource({
    params: () => this.sku(),
    stream: ({ params }) => this.api.get(params),
  });
  protected readonly reviews = rxResource({
    params: () => ({ sku: this.sku(), page: this.reviewsPage() }),
    stream: ({ params }) => this.api.reviews(params.sku, params.page, REVIEWS_PAGE_SIZE),
  });

  protected readonly notFound = computed(
    () => (this.product.error() as HttpErrorResponse | undefined)?.status === 404,
  );
  protected readonly notice = computed(() => availabilityNotice(this.product.value()));

  protected back(): void {
    // Return to the exact search (filters, page) when we came from it.
    if ((history.state as { fromSearch?: boolean } | null)?.fromSearch) this.location.back();
    else void this.router.navigate(['/products']);
  }

  protected onReviewCreated(): void {
    this.reviewsPage.set(1);
    this.reviews.reload();
    this.product.reload(); // refresh rating aggregate
  }

  protected onReviewsPage(event: PaginatorState): void {
    this.reviewsPage.set(Math.floor((event.first ?? 0) / REVIEWS_PAGE_SIZE) + 1);
  }

  protected async share(product: ProductDetail): Promise<void> {
    const result = await shareLink(window.location.href, product.name);
    this.shareFeedback.set(result === 'copied' ? 'Link copied' : result === 'failed' ? 'Could not share link' : null);
    setTimeout(() => this.shareFeedback.set(null), 2500);
  }
}

/** The "do we still sell this?" answer, stated plainly. */
export function availabilityNotice(
  p: ProductDetail | undefined,
): { severity: 'warn' | 'error'; text: string } | null {
  if (!p) return null;
  if (p.delisted) {
    return { severity: 'error', text: 'This product is no longer part of our catalogue. Please contact your sales representative for alternatives.' };
  }
  if (p.status === 'DISCONTINUED') {
    return { severity: 'error', text: 'This product has been discontinued and is no longer available.' };
  }
  if (p.status === 'PHASE_OUT') {
    return { severity: 'warn', text: 'This product is being phased out. It may not be available for new projects.' };
  }
  return null;
}
