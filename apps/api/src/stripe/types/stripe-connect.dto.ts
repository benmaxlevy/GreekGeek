import { z } from 'zod';
import {
  StripeConnectOnboardingLinkResponseSchema,
  StripeConnectRefreshLinkResponseSchema,
  StripeConnectReturnSyncResponseSchema,
  StripeConnectStatusResponseSchema,
  type StripeConnectOnboardingLinkResponse,
  type StripeConnectRefreshLinkResponse,
  type StripeConnectReturnSyncResponse,
  type StripeConnectStatusResponse,
} from '@greekgeek/contracts';

export const OrgStripeParamsSchema = z.object({
  organizationId: z.string().min(1),
});
export type OrgStripeParams = z.infer<typeof OrgStripeParamsSchema>;

export {
  StripeConnectOnboardingLinkResponseSchema,
  StripeConnectRefreshLinkResponseSchema,
  StripeConnectReturnSyncResponseSchema,
  StripeConnectStatusResponseSchema,
};
export type {
  StripeConnectOnboardingLinkResponse,
  StripeConnectRefreshLinkResponse,
  StripeConnectReturnSyncResponse,
  StripeConnectStatusResponse,
};
