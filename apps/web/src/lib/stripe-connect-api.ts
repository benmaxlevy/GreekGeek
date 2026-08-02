import {
  StripeConnectOnboardingLinkResponseSchema,
  StripeConnectRefreshLinkResponseSchema,
  StripeConnectReturnSyncResponseSchema,
  StripeConnectStatusResponseSchema,
  type StripeConnectOnboardingLinkResponse,
  type StripeConnectRefreshLinkResponse,
  type StripeConnectReturnSyncResponse,
  type StripeConnectStatusResponse,
} from '@rally/contracts';
import { apiFetch, readError } from './api';

export async function getConnectStatus(
  organizationId: string,
): Promise<StripeConnectStatusResponse> {
  const res = await apiFetch(`/api/organizations/${organizationId}/stripe/status`);
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to load Stripe Connect status'));
  }
  return StripeConnectStatusResponseSchema.parse(await res.json());
}

export async function startConnect(
  organizationId: string,
): Promise<StripeConnectOnboardingLinkResponse> {
  const res = await apiFetch(`/api/organizations/${organizationId}/stripe/connect`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to start Stripe Connect'));
  }
  return StripeConnectOnboardingLinkResponseSchema.parse(await res.json());
}

export async function syncConnectReturn(
  organizationId: string,
): Promise<StripeConnectReturnSyncResponse> {
  const res = await apiFetch(
    `/api/organizations/${organizationId}/stripe/return/sync`,
    { method: 'POST' },
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to sync Stripe Connect return'));
  }
  return StripeConnectReturnSyncResponseSchema.parse(await res.json());
}

export async function refreshConnectLink(
  organizationId: string,
): Promise<StripeConnectRefreshLinkResponse> {
  const res = await apiFetch(
    `/api/organizations/${organizationId}/stripe/refresh/link`,
    { method: 'POST' },
  );
  if (!res.ok) {
    throw new Error(await readError(res, 'Failed to refresh Stripe onboarding link'));
  }
  return StripeConnectRefreshLinkResponseSchema.parse(await res.json());
}
