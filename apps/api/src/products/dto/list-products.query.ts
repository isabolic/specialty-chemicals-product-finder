import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ProductStatus } from '../../generated/prisma/enums';

/**
 * `?region=EMEA&region=Global` arrives as an array, `?region=EMEA` as a string.
 * Normalise both (and comma-separated values) to a trimmed, non-empty array.
 */
const toArray = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const items = (Array.isArray(value) ? value : [value])
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
};

export const PRODUCT_SORTS = ['name', '-name', 'newest', 'rating'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export class ListProductsQuery {
  /** Free text: name, SKU, chemistry and description. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  q?: string;

  /** Within one filter values are OR-ed (any of the selected functions)... */
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  function?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  applicationArea?: string[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  region?: string[];

  /** ...except certifications: a customer needing Halal *and* Vegan needs both. */
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  certification?: string[];

  /** Defaults to ACTIVE only: customers should not stumble onto products we no longer sell. */
  @IsOptional()
  @Transform(({ value }) => toArray({ value })?.map((s) => s.toUpperCase()))
  @IsArray()
  @IsEnum(ProductStatus, { each: true })
  status?: ProductStatus[];

  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
