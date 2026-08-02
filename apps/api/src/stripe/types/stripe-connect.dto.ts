import { z } from 'zod';
import {
  StripeConnectOnboardingLinkResponseSchema,
  StripeConnectStatusResponseSchema,
  type StripeConnectOnboardingLinkResponse,
  type StripeConnectStatusResponse,
} from '@rally/contracts';

export const OrgStripeParamsSchema = z.object({
  organizationId: z.string().min(1),
});
export type OrgStripeParams = z.infer<typeof OrgStripeParamsSchema>;

export {
  StripeConnectOnboardingLinkResponseSchema,
  StripeConnectStatusResponseSchema,
};
export type {
  StripeConnectOnboardingLinkResponse,
  StripeConnectStatusResponse,
};
