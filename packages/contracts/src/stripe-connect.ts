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
