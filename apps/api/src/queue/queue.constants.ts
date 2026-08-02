export const QUEUE_NAMES = {
  webhookProcess: 'webhook-process',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
