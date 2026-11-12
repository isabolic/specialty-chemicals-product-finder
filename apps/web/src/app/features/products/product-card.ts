import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TagModule } from 'primeng/tag';
import { ProductSummary } from '../../core/api.types';
import { StatusTag } from '../../shared/status-tag';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, TagModule, StatusTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = product();
    <a class="card" [routerLink]="['/products', p.sku]" [state]="{ fromSearch: true }">
      <div class="card__head">
        <div>
          <h2 class="card__title">{{ p.name }}</h2>
          <div class="card__sub">{{ p.chemicalName }} · {{ p.sku }}</div>
        </div>
        @if (p.status !== 'ACTIVE') {
          <app-status-tag [status]="p.status" />
        }
      </div>
      <div class="card__meta">{{ p.function }} · {{ p.applicationArea }} · {{ p.region }}</div>
      <div class="card__foot">
        <div class="card__certs">
          @for (c of p.certifications; track c) {
            <p-tag [value]="c" severity="secondary" />
          }
        </div>
        <span class="card__rating">
          @if (p.reviewCount > 0) {
            <i class="pi pi-star-fill" aria-hidden="true"></i>
            {{ p.ratingAverage }} <span class="muted">({{ p.reviewCount }})</span>
          } @else {
            <span class="muted">No reviews yet</span>
          }
        </span>
      </div>
    </a>
  `,
  styles: `
    .card {
      display: flex; flex-direction: column; gap: 0.5rem;
      padding: 1rem; border-radius: 0.75rem;
      border: 1px solid var(--p-content-border-color);
      background: var(--p-content-background);
      color: inherit; text-decoration: none;
      transition: border-color 0.15s;
    }
    .card:hover, .card:focus-visible { border-color: var(--p-primary-color); }
    .card__head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: flex-start; }
    .card__title { margin: 0; font-size: 1.0625rem; }
    .card__sub, .card__meta, .muted { color: var(--p-text-muted-color); font-size: 0.875rem; }
    .card__foot { display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .card__certs { display: flex; flex-wrap: wrap; gap: 0.25rem; }
    .card__rating { white-space: nowrap; font-size: 0.875rem; }
    .pi-star-fill { color: var(--p-yellow-500); }
  `,
})
export class ProductCard {
  readonly product = input.required<ProductSummary>();
}
