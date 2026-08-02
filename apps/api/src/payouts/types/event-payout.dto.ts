import {
  EventPayoutActionResponseSchema,
  EventPayoutAuditSchema,
  EventPayoutIdParamsSchema,
  EventPayoutParamsSchema,
  EventPayoutQueueSchema,
  EventPayoutSchema,
  EventPayoutSummarySchema,
  PayoutReasonSchema,
  type EventPayout,
  type EventPayoutActionResponse,
  type EventPayoutAudit,
  type EventPayoutIdParams,
  type EventPayoutParams,
  type EventPayoutQueue,
  type EventPayoutSummary,
  type PayoutReason,
} from '@rally/contracts';

export {
  EventPayoutActionResponseSchema,
  EventPayoutAuditSchema,
  EventPayoutIdParamsSchema,
  EventPayoutParamsSchema,
  EventPayoutQueueSchema,
  EventPayoutSchema,
  EventPayoutSummarySchema,
  PayoutReasonSchema,
};

export type {
  EventPayout,
  EventPayoutActionResponse,
  EventPayoutAudit,
  EventPayoutIdParams,
  EventPayoutParams,
  EventPayoutQueue,
  EventPayoutSummary,
  PayoutReason,
};

export type PayoutReleaseInput = {
  eventId: string;
  mode: 'auto' | 'manual';
  actorUserId?: string;
  reason?: string;
  bypassTimeGate?: boolean;
};

export type PayoutEventLockRow = {
  id: string;
  organizationId: string;
  startsAt: Date;
  endsAt: Date | null;
  heldAt: Date | null;
  heldByUserId: string | null;
  stripeAccountId: string | null;
  stripePayoutsEnabled: boolean;
  stripeTransfersEnabled: boolean;
};
