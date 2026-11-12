import { RawProductRow } from '../src/import/normalize';

export const row = (sku: string, overrides: RawProductRow = {}): RawProductRow => ({
  sku,
  name: `Product ${sku}`,
  chemical_name: 'Glycerin',
  function: 'Emollient',
  application_area: 'Personal Care',
  region: 'Global',
  certifications: 'Vegan',
  status: 'Active',
  launch_year: '2020',
  description: 'Test product.',
  ...overrides,
});
