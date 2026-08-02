import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import type { Env } from '../config/env.schema';

const ACCOUNT_INCLUDE = [
  'configuration.merchant',
  'configuration.recipient',
  'identity',
  'requirements',
  'defaults',
] as const;

@Injectable()
export class StripeService {
  readonly client: Stripe;

  constructor(config: ConfigService<Env, true>) {
    const secretKey = config.get('STRIPE_SECRET_KEY', { infer: true });
    const apiVersion = config.get('STRIPE_API_VERSION', { infer: true });
    // SDK types pin GA version; Connect uses preview pin from env.
    this.client = new Stripe(secretKey, {
      apiVersion: apiVersion as Stripe.LatestApiVersion,
    });
  }

  createConnectAccount(input: {
    displayName: string;
    organizationId: string;
    contactEmail: string;
  }): Promise<Stripe.V2.Core.Account> {
    return this.client.v2.core.accounts.create({
      display_name: input.displayName,
      contact_email: input.contactEmail,
      dashboard: 'express',
      identity: {
        country: 'us',
        entity_type: 'company',
      },
      configuration: {
        merchant: {
          capabilities: {
            card_payments: { requested: true },
          },
        },
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: { requested: true },
            },
          },
        },
      },
      defaults: {
        currency: 'usd',
        responsibilities: {
          fees_collector: 'application',
          losses_collector: 'application',
        },
      },
      metadata: {
        organizationId: input.organizationId,
      },
      include: [...ACCOUNT_INCLUDE],
    });
  }

  retrieveAccount(accountId: string): Promise<Stripe.V2.Core.Account> {
    return this.client.v2.core.accounts.retrieve(accountId, {
      include: [...ACCOUNT_INCLUDE],
    });
  }

  cancelPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.client.paymentIntents.cancel(paymentIntentId);
  }

  createPaymentIntent(input: {
    amountCents: number;
    currency: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
  }): Promise<Stripe.PaymentIntent> {
    return this.client.paymentIntents.create(
      {
        amount: input.amountCents,
        currency: input.currency,
        automatic_payment_methods: { enabled: true },
        metadata: input.metadata,
      },
      { idempotencyKey: input.idempotencyKey },
    );
  }

  retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    return this.client.paymentIntents.retrieve(paymentIntentId);
  }

  updatePaymentIntentAmount(
    paymentIntentId: string,
    amountCents: number,
  ): Promise<Stripe.PaymentIntent> {
    return this.client.paymentIntents.update(paymentIntentId, {
      amount: amountCents,
    });
  }

  createAccountLink(input: {
    accountId: string;
    useCaseType: 'account_onboarding' | 'account_update';
    returnUrl: string;
    refreshUrl: string;
  }): Promise<Stripe.V2.Core.AccountLink> {
    const flow =
      input.useCaseType === 'account_update'
        ? {
            type: 'account_update' as const,
            account_update: {
              configurations: ['recipient', 'merchant'] as Array<
                'recipient' | 'merchant'
              >,
              return_url: input.returnUrl,
              refresh_url: input.refreshUrl,
            },
          }
        : {
            type: 'account_onboarding' as const,
            account_onboarding: {
              configurations: ['recipient', 'merchant'] as Array<
                'recipient' | 'merchant'
              >,
              return_url: input.returnUrl,
              refresh_url: input.refreshUrl,
            },
          };

    return this.client.v2.core.accountLinks.create({
      account: input.accountId,
      use_case: flow,
    });
  }
}
