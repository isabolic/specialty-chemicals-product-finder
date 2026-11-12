import { ProductDetail } from '../../core/api.types';
import { availabilityNotice } from './product-detail.page';

const base: ProductDetail = {
  sku: 'P-1', name: 'Alpha', chemicalName: 'Carbomer', function: 'Rheology Modifier',
  applicationArea: 'Personal Care', region: 'Global', certifications: [], status: 'ACTIVE',
  launchYear: 2020, ratingAverage: null, reviewCount: 0, description: '', delisted: false,
};

describe('availabilityNotice', () => {
  it('says nothing for available products', () => {
    expect(availabilityNotice(base)).toBeNull();
  });

  it.each([
    [{ status: 'PHASE_OUT' as const }, 'warn', 'phased out'],
    [{ status: 'DISCONTINUED' as const }, 'error', 'discontinued'],
    [{ delisted: true }, 'error', 'no longer part of our catalogue'],
    [{ delisted: true, status: 'PHASE_OUT' as const }, 'error', 'no longer part of our catalogue'],
  ])('warns clearly for %p', (override, severity, text) => {
    const notice = availabilityNotice({ ...base, ...override });
    expect(notice?.severity).toBe(severity);
    expect(notice?.text).toContain(text);
  });
});
