import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { ProductStatus } from '../core/api.types';

const STATUS: Record<ProductStatus, { label: string; severity: 'success' | 'warn' | 'danger' }> = {
  ACTIVE: { label: 'Available', severity: 'success' },
  PHASE_OUT: { label: 'Being phased out', severity: 'warn' },
  DISCONTINUED: { label: 'Discontinued', severity: 'danger' },
};

@Component({
  selector: 'app-status-tag',
  imports: [TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p-tag [value]="config().label" [severity]="config().severity" />`,
})
export class StatusTag {
  readonly status = input.required<ProductStatus>();
  protected readonly config = computed(() => STATUS[this.status()]);
}
