import { Injectable } from '@nestjs/common';
import type { WebhookEventHandler } from './types/webhook-handler.dto';

/**
 * Maps Stripe (or other) event `type` → business handler.
 * Unregistered types are ignored by the processor (mark processed, no retry).
 */
@Injectable()
export class WebhookHandlerRegistry {
  private readonly handlers = new Map<string, WebhookEventHandler>();

  register(type: string, handler: WebhookEventHandler): void {
    this.handlers.set(type, handler);
  }

  get(type: string): WebhookEventHandler | undefined {
    return this.handlers.get(type);
  }
}
