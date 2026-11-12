import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { Subject, debounceTime, distinctUntilChanged, map } from 'rxjs';
import { ProductsApi } from '../../core/products-api';
import { shareLink } from '../../shared/share-link';
import { ProductCard } from './product-card';
import { ProductFiltersPanel } from './product-filters';
import {
  DEFAULT_STATE,
  PAGE_SIZE,
  SearchState,
  Sort,
  activeFilterCount,
  fromParamMap,
  toApiParams,
  toQueryParams,
} from './search-state';

const SORT_OPTIONS: { label: string; value: Sort }[] = [
  { label: 'Name (A–Z)', value: 'name' },
  { label: 'Name (Z–A)', value: '-name' },
  { label: 'Newest launch', value: 'newest' },
  { label: 'Best rated', value: 'rating' },
];

@Component({
  selector: 'app-product-search-page',
  imports: [
    FormsModule,
    ButtonModule,
    DrawerModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    MessageModule,
    PaginatorModule,
    SelectModule,
    SkeletonModule,
    ProductCard,
    ProductFiltersPanel,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-search.page.html',
  styleUrl: './product-search.page.scss',
})
export class ProductSearchPage {
  private readonly api = inject(ProductsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** The URL is the source of truth; everything below derives from it. */
  protected readonly state = toSignal(this.route.queryParamMap.pipe(map(fromParamMap)), {
    initialValue: DEFAULT_STATE,
  });

  protected readonly results = rxResource({
    params: () => toApiParams(this.state()),
    stream: ({ params }) => this.api.search(params),
  });
  protected readonly filterOptions = rxResource({ stream: () => this.api.filters() });

  protected readonly searchText = signal('');
  protected readonly filtersOpen = signal(false);
  protected readonly shareFeedback = signal<string | null>(null);
  protected readonly filterCount = computed(() => activeFilterCount(this.state()));
  protected readonly first = computed(() => (this.state().page - 1) * PAGE_SIZE);
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly skeletons = Array.from({ length: 4 });

  private readonly typed = new Subject<string>();

  constructor() {
    // Keep the input in sync when the URL changes (back button, shared link).
    effect(() => this.searchText.set(this.state().q));

    this.typed
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      // Typing replaces the history entry instead of adding one per keystroke.
      .subscribe((q) => this.update({ q: q.trim() }, true));
  }

  protected onType(q: string): void {
    this.searchText.set(q);
    this.typed.next(q);
  }

  protected update(change: Partial<SearchState>, replaceUrl = false): void {
    // Any change other than paging starts again at page 1.
    const next = { ...this.state(), page: 1, ...change };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(next),
      replaceUrl,
    });
  }

  protected clearFilters(): void {
    this.update({ ...DEFAULT_STATE, q: this.state().q, sort: this.state().sort });
  }

  protected resetAll(): void {
    this.update({ ...DEFAULT_STATE });
  }

  protected onPage(event: PaginatorState): void {
    this.update({ page: Math.floor((event.first ?? 0) / PAGE_SIZE) + 1 });
    window.scrollTo({ top: 0 });
  }

  protected async share(): Promise<void> {
    const result = await shareLink(window.location.href, 'Product Finder search');
    this.shareFeedback.set(result === 'copied' ? 'Link copied' : result === 'failed' ? 'Could not share link' : null);
    setTimeout(() => this.shareFeedback.set(null), 2500);
  }
}
