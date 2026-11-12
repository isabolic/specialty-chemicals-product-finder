import { Controller, Get, Param, Query } from '@nestjs/common';
import { ListProductsQuery } from './dto/list-products.query';
import { Page, ProductDetail, ProductFilters, ProductSummary } from './product.types';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: ListProductsQuery): Promise<Page<ProductSummary>> {
    return this.products.list(query);
  }

  /** Declared before `:sku` so "filters" is not treated as a SKU. */
  @Get('filters')
  filters(): Promise<ProductFilters> {
    return this.products.filters();
  }

  @Get(':sku')
  get(@Param('sku') sku: string): Promise<ProductDetail> {
    return this.products.getBySku(sku);
  }
}
