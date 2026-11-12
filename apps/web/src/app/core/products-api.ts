import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { NewReview, Page, ProductDetail, ProductFilters, ProductSummary, Review } from './api.types';

export type QueryParams = Record<string, string | number | readonly string[]>;

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/products';

  search(params: QueryParams): Observable<Page<ProductSummary>> {
    return this.http.get<Page<ProductSummary>>(this.base, { params });
  }

  filters(): Observable<ProductFilters> {
    return this.http.get<ProductFilters>(`${this.base}/filters`);
  }

  get(sku: string): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(`${this.base}/${encodeURIComponent(sku)}`);
  }

  reviews(sku: string, page: number, pageSize: number): Observable<Page<Review>> {
    return this.http.get<Page<Review>>(`${this.base}/${encodeURIComponent(sku)}/reviews`, {
      params: { page, pageSize },
    });
  }

  createReview(sku: string, review: NewReview): Observable<Review> {
    return this.http.post<Review>(`${this.base}/${encodeURIComponent(sku)}/reviews`, review);
  }
}
