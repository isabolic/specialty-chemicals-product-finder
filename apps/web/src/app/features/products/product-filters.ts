import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { MultiSelectModule } from 'primeng/multiselect';
import { FilterOption, ProductFilters } from '../../core/api.types';
import { MultiFilter, SearchState } from './search-state';

interface FilterDef {
  key: MultiFilter;
  label: string;
}

const FILTERS: FilterDef[] = [
  { key: 'applicationArea', label: 'Application area' },
  { key: 'function', label: 'Function' },
  { key: 'certification', label: 'Certifications (all of)' },
  { key: 'region', label: 'Region' },
];

/** Stateless: renders the current state and emits changes; the page owns the URL. */
@Component({
  selector: 'app-product-filters',
  imports: [FormsModule, MultiSelectModule, CheckboxModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (f of filters; track f.key) {
      <div class="field">
        <label [for]="'filter-' + f.key">{{ f.label }}</label>
        <p-multiselect
          [inputId]="'filter-' + f.key"
          [options]="optionsFor(f.key)"
          optionLabel="label"
          optionValue="value"
          [ngModel]="state()[f.key]"
          (ngModelChange)="emit(f.key, $event)"
          [placeholder]="'Any'"
          [maxSelectedLabels]="2"
          display="chip"
          [showClear]="true"
          appendTo="body"
          styleClass="w-full"
        />
      </div>
    }
    <div class="field field--inline">
      <p-checkbox
        inputId="filter-inactive"
        [binary]="true"
        [ngModel]="state().includeInactive"
        (ngModelChange)="changed.emit({ includeInactive: $event })"
      />
      <label for="filter-inactive">Include phase-out and discontinued products</label>
    </div>
    <p-button label="Clear filters" [text]="true" (onClick)="cleared.emit()" />
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 1rem; }
    .field { display: flex; flex-direction: column; gap: 0.375rem; }
    .field label { font-size: 0.875rem; font-weight: 600; }
    .field--inline { flex-direction: row; align-items: center; gap: 0.5rem; }
    .field--inline label { font-weight: 400; }
    :host ::ng-deep .w-full { width: 100%; }
  `,
})
export class ProductFiltersPanel {
  readonly state = input.required<SearchState>();
  readonly options = input<ProductFilters | undefined>();
  readonly changed = output<Partial<SearchState>>();
  readonly cleared = output<void>();

  protected readonly filters = FILTERS;

  protected emit(key: MultiFilter, values: string[] | null): void {
    this.changed.emit({ [key]: values ?? [] });
  }

  protected optionsFor(key: MultiFilter): { label: string; value: string }[] {
    const opts: FilterOption[] = this.options()?.[key] ?? [];
    // Keep selected values visible even if they no longer exist in the catalogue.
    const known = new Set(opts.map((o) => o.value));
    const stale = this.state()[key].filter((v) => !known.has(v)).map((value) => ({ value, count: 0 }));
    return [...opts, ...stale].map((o) => ({ label: `${o.value} (${o.count})`, value: o.value }));
  }
}
