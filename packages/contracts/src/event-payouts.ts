import { z } from 'zod';

export const EventPayoutStatusSchema = z.enum(['pending', 'released', 'failed', 'blocked']);
export type EventPayoutStatus = z.infer<typeof EventPayoutStatusSchema>;

export const PayoutReleaseModeSchema = z.enum(['auto', 'manual']);
export type PayoutReleaseMode = z.infer<typeof PayoutReleaseModeSchema>;

export const PayoutExcludedReasonSchema = z.enum(['disputed', 'refunded', 'voided']);
export type PayoutExcludedReason = z.infer<typeof PayoutExcludedReasonSchema>;

export const PayoutAuditActionSchema = z.enum(['hold', 'clear', 'release', 'retry']);
export type PayoutAuditAction = z.infer<typeof PayoutAuditActionSchema>;

export const PayoutBlockedReasonSchema = z.enum([
  'held',
  'before_hold_period',
  'missing_stripe_account',
  'payouts_disabled',
  'transfers_disabled',
  'no_eligible_purchases',
  'transfer_failed',
]);
export type PayoutBlockedReason = z.infer<typeof PayoutBlockedReasonSchema>;

export const EventPayoutSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  batchSeq: z.number().int().positive(),
  amountCents: z.number().int().nonnegative(),
  status: EventPayoutStatusSchema,
  releasedAt: z.string().datetime().nullable(),
  releaseMode: PayoutReleaseModeSchema.nullable(),
  releasedByUserId: z.string().nullable(),
  stripeTransferId: z.string().nullable(),
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  postReleaseExposure: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type EventPayout = z.infer<typeof EventPayoutSchema>;

export const EventPayoutAuditSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  eventPayoutId: z.string().nullable(),
  actorUserId: z.string(),
  action: PayoutAuditActionSchema,
  reason: z.string().min(1),
  createdAt: z.string().datetime(),
});
export type EventPayoutAudit = z.infer<typeof EventPayoutAuditSchema>;

export const PayoutReadinessSchema = z.object({
  stripeAccountId: z.string().nullable(),
  stripePayoutsEnabled: z.boolean(),
  stripeTransfersEnabled: z.boolean(),
  ready: z.boolean(),
  blockedReason: PayoutBlockedReasonSchema.nullable(),
});
export type PayoutReadiness = z.infer<typeof PayoutReadinessSchema>;

export const EventPayoutSummarySchema = z.object({
  eventId: z.string(),
  grossAmountCents: z.number().int().nonnegative(),
  feeCents: z.number().int().nonnegative(),
  netCents: z.number().int().nonnegative(),
  releasedCents: z.number().int().nonnegative(),
  pendingCents: z.number().int().nonnegative(),
  excludedCents: z.number().int().nonnegative(),
  excludedCount: z.number().int().nonnegative(),
  excludedByReason: z.object({
    disputed: z.number().int().nonnegative(),
    refunded: z.number().int().nonnegative(),
    voided: z.number().int().nonnegative(),
  }),
  expectedPayoutDate: z.string().datetime(),
  heldAt: z.string().datetime().nullable(),
  heldByUserId: z.string().nullable(),
  blockedReason: PayoutBlockedReasonSchema.nullable(),
  readiness: PayoutReadinessSchema,
  postReleaseExposure: z.boolean(),
  payouts: z.array(EventPayoutSchema),
  audits: z.array(EventPayoutAuditSchema),
});
export type EventPayoutSummary = z.infer<typeof EventPayoutSummarySchema>;

export const EventPayoutQueueItemSchema = EventPayoutSummarySchema.extend({
  eligibleNow: z.boolean(),
});
export type EventPayoutQueueItem = z.infer<typeof EventPayoutQueueItemSchema>;

export const EventPayoutQueueSchema = z.array(EventPayoutQueueItemSchema);
export type EventPayoutQueue = z.infer<typeof EventPayoutQueueSchema>;

export const PayoutReasonSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export type PayoutReason = z.infer<typeof PayoutReasonSchema>;

export const EventPayoutParamsSchema = z.object({
  eventId: z.string().min(1),
});
export type EventPayoutParams = z.infer<typeof EventPayoutParamsSchema>;

export const EventPayoutIdParamsSchema = z.object({
  eventId: z.string().min(1),
  payoutId: z.string().min(1),
});
export type EventPayoutIdParams = z.infer<typeof EventPayoutIdParamsSchema>;

export const EventPayoutActionResponseSchema = z.object({
  payout: EventPayoutSchema.nullable(),
  audit: EventPayoutAuditSchema,
});
export type EventPayoutActionResponse = z.infer<typeof EventPayoutActionResponseSchema>;
