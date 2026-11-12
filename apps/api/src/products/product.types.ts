import { Product } from '../generated/prisma/client';
import { ProductStatus } from '../generated/prisma/enums';

/**
 * Public API shapes. Deliberately decoupled from the Prisma model: internal
 * columns (id, timestamps) stay internal, and a schema change does not
 * silently change the API contract.
 */
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
  /** No longer in the PIM export. Shown with a notice, so old links keep working. */
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

export function toSummary(p: Product): ProductSummary {
  return {
    sku: p.sku,
    name: p.name,
    chemicalName: p.chemicalName,
    function: p.function,
    applicationArea: p.applicationArea,
    region: p.region,
    certifications: p.certifications,
    status: p.status,
    launchYear: p.launchYear,
    ratingAverage: p.ratingAverage === null ? null : Math.round(p.ratingAverage * 10) / 10,
    reviewCount: p.reviewCount,
  };
}

export function toDetail(p: Product): ProductDetail {
  return { ...toSummary(p), description: p.description, delisted: p.delistedAt !== null };
}
