import { queryOptions } from '@tanstack/react-query';
import { fetchMe } from './api';
import { fetchProfileSummary } from './profile-api';

export const meQueryKey = ['me'] as const;
export const profileSummaryQueryKey = ['me', 'summary'] as const;

export const meQueryOptions = queryOptions({
  queryKey: meQueryKey,
  queryFn: fetchMe,
  staleTime: 30_000,
  retry: false,
});

export const profileSummaryQueryOptions = (userId: string | null) =>
  queryOptions({
    queryKey: [...profileSummaryQueryKey, userId] as const,
    queryFn: fetchProfileSummary,
    enabled: userId !== null,
    retry: false,
  });
