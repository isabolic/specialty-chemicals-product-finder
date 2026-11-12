import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NavigationEnd, Router, provideRouter } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { RouterTestingHarness } from '@angular/router/testing';
import { Page, ProductSummary } from '../../core/api.types';
import { ProductFiltersPanel } from './product-filters';
import { ProductSearchPage } from './product-search.page';

const product = (sku: string, name: string): ProductSummary => ({
  sku,
  name,
  chemicalName: 'Carbomer',
  function: 'Rheology Modifier',
  applicationArea: 'Personal Care',
  region: 'Global',
  certifications: ['Vegan'],
  status: 'ACTIVE',
  launchYear: 2020,
  ratingAverage: null,
  reviewCount: 0,
});

describe('ProductSearchPage', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'products', component: ProductSearchPage }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  async function open(url: string): Promise<void> {
    await harness.navigateByUrl(url, ProductSearchPage);
    http.expectOne('/api/products/filters').flush({
      function: [], applicationArea: [], region: [], certification: [], status: [],
    });
  }

  function respond(page: Partial<Page<ProductSummary>>) {
    const req = http.expectOne((r) => r.url === '/api/products');
    req.flush({ items: [], total: 0, page: 1, pageSize: 20, ...page });
    return req;
  }

  it('restores a shared link: the URL drives the API query', async () => {
    await open('/products?q=gel&function=Surfactant&function=Emulsifier&inactive=1&sort=rating&page=2');
    const req = respond({ items: [product('P-1', 'Alpha Gel')], total: 21, page: 2 });

    expect(req.request.params.get('q')).toBe('gel');
    expect(req.request.params.getAll('function')).toEqual(['Surfactant', 'Emulsifier']);
    expect(req.request.params.getAll('status')).toEqual(['ACTIVE', 'PHASE_OUT', 'DISCONTINUED']);
    expect(req.request.params.get('sort')).toBe('rating');
    expect(req.request.params.get('page')).toBe('2');

    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('Alpha Gel');
    expect(harness.routeNativeElement?.textContent).toContain('21 products');
  });

  it('shows only available products by default and says so', async () => {
    await open('/products');
    const req = respond({ items: [product('P-1', 'Alpha Gel')], total: 1 });
    expect(req.request.params.getAll('status')).toEqual(['ACTIVE']);

    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('currently available');
  });

  it('writes filter changes to the URL and resets to page 1', async () => {
    await open('/products?q=gel&page=3');
    respond({});
    await harness.fixture.whenStable();

    const router = TestBed.inject(Router);
    const navigated = firstValueFrom(router.events.pipe(filter((e) => e instanceof NavigationEnd)));
    const panel = harness.routeDebugElement!.query(By.directive(ProductFiltersPanel));
    (panel.componentInstance as ProductFiltersPanel).changed.emit({ region: ['EMEA'] });
    await navigated;
    TestBed.tick();

    expect(router.url).toBe('/products?q=gel&region=EMEA');
    const req = respond({});
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.getAll('region')).toEqual(['EMEA']);
  });

  it('shows an empty state with a way out', async () => {
    await open('/products?q=nothing');
    respond({ items: [], total: 0 });
    await harness.fixture.whenStable();
    expect(harness.routeNativeElement?.textContent).toContain('No products match your search.');
    expect(harness.routeNativeElement?.textContent).toContain('Clear search and filters');
  });
});
