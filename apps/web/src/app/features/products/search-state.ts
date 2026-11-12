import { ParamMap, Params } from '@angular/router';
import { QueryParams } from '../../core/products-api';

/**
 * Everything the user is looking at lives in the URL, so a link reproduces
 * the exact view. This module is the single translation point between the
 * URL, the UI state and the API query.
 */
export const SORTS = ['name', '-name', 'newest', 'rating'] as const;
export type Sort = (typeof SORTS)[number];

export const MULTI_FILTERS = ['function', 'applicationArea', 'region', 'certification'] as const;
export type MultiFilter = (typeof MULTI_FILTERS)[number];

export const PAGE_SIZE = 20;

export interface SearchState {
  q: string;
  function: string[];
  applicationArea: string[];
  region: string[];
  certification: string[];
  /** Also show phase-out and discontinued products. */
  includeInactive: boolean;
  sort: Sort;
  page: number;
}

export const DEFAULT_STATE: SearchState = {
  q: '',
  function: [],
  applicationArea: [],
  region: [],
  certification: [],
  includeInactive: false,
  sort: 'name',
  page: 1,
};

export function fromParamMap(params: ParamMap): SearchState {
  const sort = params.get('sort') as Sort | null;
  const page = Number(params.get('page'));
  return {
    q: (params.get('q') ?? '').trim(),
    function: params.getAll('function'),
    applicationArea: params.getAll('applicationArea'),
    region: params.getAll('region'),
    certification: params.getAll('certification'),
    includeInactive: params.get('inactive') === '1',
    sort: sort && SORTS.includes(sort) ? sort : DEFAULT_STATE.sort,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** Router query params; defaults are omitted to keep shared links short. */
export function toQueryParams(state: SearchState): Params {
  return {
    q: state.q || null,
    function: state.function.length ? state.function : null,
    applicationArea: state.applicationArea.length ? state.applicationArea : null,
    region: state.region.length ? state.region : null,
    certification: state.certification.length ? state.certification : null,
    inactive: state.includeInactive ? '1' : null,
    sort: state.sort === DEFAULT_STATE.sort ? null : state.sort,
    page: state.page > 1 ? state.page : null,
  };
}

export function toApiParams(state: SearchState): QueryParams {
  const params: QueryParams = { page: state.page, pageSize: PAGE_SIZE, sort: state.sort };
  if (state.q) params['q'] = state.q;
  for (const key of MULTI_FILTERS) {
    if (state[key].length) params[key] = state[key];
  }
  params['status'] = state.includeInactive ? ['ACTIVE', 'PHASE_OUT', 'DISCONTINUED'] : ['ACTIVE'];
  return params;
}

export function activeFilterCount(state: SearchState): number {
  return MULTI_FILTERS.reduce((n, key) => n + state[key].length, 0) + (state.includeInactive ? 1 : 0);
}
