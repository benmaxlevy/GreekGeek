export const QUEUE_NAMES = {
  prove: 'prove',
  webhookProcess: 'webhook-process',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
