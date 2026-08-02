import { z } from 'zod';

/** Serializable snapshot of outstanding Stripe requirements (shape varies by API version). */
export const StripeRequirementsDueSchema = z.unknown().nullable();
export type StripeRequirementsDue = z.infer<typeof StripeRequirementsDueSchema>;

export const OrgStripeFieldsSchema = z.object({
  stripeAccountId: z.string().nullable(),
  stripeChargesEnabled: z.boolean(),
  stripePayoutsEnabled: z.boolean(),
  stripeDetailsSubmitted: z.boolean(),
  stripeRequirementsDue: StripeRequirementsDueSchema,
  stripeAccountUpdatedAt: z.string().datetime().nullable(),
});
export type OrgStripeFields = z.infer<typeof OrgStripeFieldsSchema>;

export const StripeConnectStatusResponseSchema = OrgStripeFieldsSchema;
export type StripeConnectStatusResponse = z.infer<
  typeof StripeConnectStatusResponseSchema
>;

/** Hosted onboarding / account-link URL for client redirect. */
export const StripeConnectOnboardingLinkResponseSchema = z.object({
  url: z.string().url(),
});
export type StripeConnectOnboardingLinkResponse = z.infer<
  typeof StripeConnectOnboardingLinkResponseSchema
>;

/** FE bridge: sync return from Stripe, then navigate in-app. */
export const StripeConnectReturnSyncResponseSchema = z.object({
  redirectTo: z.string().url(),
});
export type StripeConnectReturnSyncResponse = z.infer<
  typeof StripeConnectReturnSyncResponseSchema
>;

/** FE bridge: mint refresh link as JSON (no 303). */
export const StripeConnectRefreshLinkResponseSchema =
  StripeConnectOnboardingLinkResponseSchema;
export type StripeConnectRefreshLinkResponse =
  StripeConnectOnboardingLinkResponse;
