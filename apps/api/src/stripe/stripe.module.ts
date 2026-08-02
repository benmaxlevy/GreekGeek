import { Module } from '@nestjs/common';
import { PermissionsModule } from '../permissions/permissions.module';
import { WebhookHandlerRegistry } from '../webhooks/webhook-handler.registry';
import { StripeConnectController } from './stripe-connect.controller';
import { StripeConnectService } from './stripe-connect.service';
import { StripeService } from './stripe.service';
import { StripeWebhookHandlers } from './stripe-webhook.handlers';

@Module({
  imports: [PermissionsModule],
  controllers: [StripeConnectController],
  providers: [
    StripeService,
    StripeConnectService,
    WebhookHandlerRegistry,
    StripeWebhookHandlers,
  ],
  exports: [
    StripeService,
    StripeConnectService,
    WebhookHandlerRegistry,
    StripeWebhookHandlers,
  ],
})
export class StripeModule {}
