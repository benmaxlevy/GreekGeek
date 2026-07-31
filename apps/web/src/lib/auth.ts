import { queryOptions } from '@tanstack/react-query';
import { fetchMe } from './api';

export const meQueryKey = ['me'] as const;

export const meQueryOptions = queryOptions({
  queryKey: meQueryKey,
  queryFn: fetchMe,
  staleTime: 30_000,
  retry: false,
});
