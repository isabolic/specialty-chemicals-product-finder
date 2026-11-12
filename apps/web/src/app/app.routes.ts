import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  {
    path: 'products',
    title: 'Product Finder',
    loadComponent: () =>
      import('./features/products/product-search.page').then((m) => m.ProductSearchPage),
  },
  { path: '**', redirectTo: 'products' },
];
