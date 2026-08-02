export const QUEUE_NAMES = {
  webhookProcess: 'webhook-process',
  purchaseTtlSweep: 'purchase-ttl-sweep',
  eventPayoutSweep: 'event-payout-sweep',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
