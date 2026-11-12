import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { RatingModule } from 'primeng/rating';
import { TextareaModule } from 'primeng/textarea';
import { Review } from '../../core/api.types';
import { ProductsApi } from '../../core/products-api';

/** Limits mirror the API's validation (CreateReviewDto). */
export const REVIEW_LIMITS = { authorName: 80, title: 120, body: 4000 } as const;

@Component({
  selector: 'app-review-form',
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, MessageModule, RatingModule, TextareaModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="field">
        <span id="rating-label" class="label">Your rating *</span>
        <p-rating formControlName="rating" aria-labelledby="rating-label" />
      </div>
      <div class="field">
        <label for="review-author">Your name *</label>
        <input pInputText id="review-author" formControlName="authorName" [maxlength]="limits.authorName" autocomplete="name" />
      </div>
      <div class="field">
        <label for="review-title">Title</label>
        <input pInputText id="review-title" formControlName="title" [maxlength]="limits.title" />
      </div>
      <div class="field">
        <label for="review-body">Your experience *</label>
        <textarea pTextarea id="review-body" formControlName="body" rows="4" [maxlength]="limits.body"></textarea>
        <small class="muted">Visible to everyone using the Product Finder.</small>
      </div>
      @if (error(); as message) {
        <p-message severity="error" >{{ message }}</p-message>
      }
      <p-button type="submit" label="Publish review" [loading]="submitting()" [disabled]="form.invalid" />
    </form>
  `,
  styles: `
    form { display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
    .field { display: flex; flex-direction: column; gap: 0.375rem; width: 100%; }
    .field label, .label { font-size: 0.875rem; font-weight: 600; }
    input, textarea { width: 100%; }
    .muted { color: var(--p-text-muted-color); }
    /* Comfortable tap targets on phones. */
    :host ::ng-deep .p-rating { gap: 0.5rem; }
    :host ::ng-deep .p-rating-icon { width: 1.5rem; height: 1.5rem; }
  `,
})
export class ReviewForm {
  private readonly api = inject(ProductsApi);

  readonly sku = input.required<string>();
  readonly created = output<Review>();

  protected readonly limits = REVIEW_LIMITS;
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    rating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
    authorName: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(REVIEW_LIMITS.authorName)]],
    title: ['', [Validators.maxLength(REVIEW_LIMITS.title)]],
    body: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(REVIEW_LIMITS.body)]],
  });

  protected submit(): void {
    if (this.form.invalid || this.submitting()) return;
    const { rating, authorName, title, body } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.api
      .createReview(this.sku(), { rating, authorName, body, ...(title.trim() ? { title } : {}) })
      .subscribe({
        next: (review) => {
          this.submitting.set(false);
          this.form.reset();
          this.created.emit(review);
        },
        error: (err: HttpErrorResponse) => {
          this.submitting.set(false);
          this.error.set(errorMessage(err));
        },
      });
  }
}

function errorMessage(err: HttpErrorResponse): string {
  switch (err.status) {
    case 429:
      return 'You have posted several reviews in a short time. Please wait a minute and try again.';
    case 409:
      return 'This product is no longer in our catalogue, so it cannot be reviewed.';
    case 400:
      return 'Please check your review and try again.';
    default:
      return 'Your review could not be published. Please try again.';
  }
}
