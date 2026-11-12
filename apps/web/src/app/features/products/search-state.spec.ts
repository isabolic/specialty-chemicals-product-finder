import { convertToParamMap } from '@angular/router';
import { DEFAULT_STATE, fromParamMap, toApiParams, toQueryParams } from './search-state';

describe('search state <-> URL', () => {
  it('reads every part of the view from the URL', () => {
    const state = fromParamMap(
      convertToParamMap({
        q: ' gel ',
        function: ['Surfactant', 'Emulsifier'],
        certification: 'Vegan',
        inactive: '1',
        sort: 'rating',
        page: '3',
      }),
    );
    expect(state).toEqual({
      ...DEFAULT_STATE,
      q: 'gel',
      function: ['Surfactant', 'Emulsifier'],
      certification: ['Vegan'],
      includeInactive: true,
      sort: 'rating',
      page: 3,
    });
  });

  it('falls back to defaults for tampered or invalid values', () => {
    expect(fromParamMap(convertToParamMap({ sort: 'price', page: '-2', inactive: 'yes' }))).toEqual(DEFAULT_STATE);
    expect(fromParamMap(convertToParamMap({ page: '1.5' })).page).toBe(1);
  });

  it('omits defaults so shared links stay short', () => {
    expect(Object.values(toQueryParams(DEFAULT_STATE)).every((v) => v === null)).toBe(true);
  });

  it('round-trips through the URL', () => {
    const state = { ...DEFAULT_STATE, q: 'thickener', region: ['EMEA'], sort: 'newest' as const, page: 2 };
    // The router drops null-valued params; mirror that here.
    const params = Object.fromEntries(Object.entries(toQueryParams(state)).filter(([, v]) => v !== null));
    expect(fromParamMap(convertToParamMap(params))).toEqual(state);
  });

  it('asks the API for available products only, unless inactive ones are requested', () => {
    expect(toApiParams(DEFAULT_STATE)['status']).toEqual(['ACTIVE']);
    expect(toApiParams({ ...DEFAULT_STATE, includeInactive: true })['status']).toEqual([
      'ACTIVE',
      'PHASE_OUT',
      'DISCONTINUED',
    ]);
  });

  it('sends only filters that are set', () => {
    expect(toApiParams({ ...DEFAULT_STATE, function: ['Solvent'] })).toEqual({
      page: 1,
      pageSize: 20,
      sort: 'name',
      function: ['Solvent'],
      status: ['ACTIVE'],
    });
  });
});
