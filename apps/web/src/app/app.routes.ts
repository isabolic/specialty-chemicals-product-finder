import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  {
    path: 'products',
    title: 'Product Finder',
    loadComponent: () =>
      import('./features/products/product-search.page').then((m) => m.ProductSearchPage),
  },
  {
    path: 'products/:sku',
    title: 'Product · Product Finder',
    loadComponent: () =>
      import('./features/products/product-detail.page').then((m) => m.ProductDetailPage),
  },
  { path: '**', redirectTo: 'products' },
];
