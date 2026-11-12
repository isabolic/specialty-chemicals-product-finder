/**
 * Mirrors the API contract (apps/api/src/products/product.types.ts).
 * Kept by hand for v1; a shared contracts package or generated OpenAPI
 * client is the next step once the API grows.
 */
export type ProductStatus = 'ACTIVE' | 'PHASE_OUT' | 'DISCONTINUED';

export interface ProductSummary {
  sku: string;
  name: string;
  chemicalName: string;
  function: string;
  applicationArea: string;
  region: string;
  certifications: string[];
  status: ProductStatus;
  launchYear: number | null;
  ratingAverage: number | null;
  reviewCount: number;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  delisted: boolean;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FilterOption {
  value: string;
  count: number;
}

export interface ProductFilters {
  function: FilterOption[];
  applicationArea: FilterOption[];
  region: FilterOption[];
  certification: FilterOption[];
  status: FilterOption[];
}

export interface Review {
  id: string;
  rating: number;
  authorName: string;
  title: string | null;
  body: string;
  createdAt: string;
}

export interface NewReview {
  rating: number;
  authorName: string;
  title?: string;
  body: string;
}
