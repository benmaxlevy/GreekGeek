/**
 * Business handler invoked by the webhook inbox worker for a registered event type.
 * Unknown types skip handlers and are marked processed by the processor.
 */
export type WebhookHandlerContext = {
  type: string;
  payload: unknown;
  webhookEventId: string;
};

export type WebhookEventHandler = (
  ctx: WebhookHandlerContext,
) => Promise<void>;
