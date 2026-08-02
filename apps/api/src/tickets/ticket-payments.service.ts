import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PublicUser } from '../auth/types/auth.dto';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import {
  computeRallyFee,
  type TicketCheckoutResponse,
} from './types/ticket-payments.dto';

type CheckoutTicketContext = {
  id: string;
  status: string;
  holderUserId: string | null;
  allocation: {
    id: string;
    status: string;
    priceCents: number | null;
    event: {
      id: string;
      organizationId: string;
      ticketingEnabled: boolean;
      ticketSaleStatus: string | null;
      organization: {
        stripeChargesEnabled: boolean;
      };
    };
  };
};

@Injectable()
export class TicketPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async checkout(
    ticketId: string,
    caller: PublicUser,
  ): Promise<TicketCheckoutResponse> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        allocation: {
          include: {
            event: {
              include: {
                organization: {
                  select: { stripeChargesEnabled: true },
                },
              },
            },
          },
        },
      },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.holderUserId !== caller.id) {
      throw new ForbiddenException('Only the ticket holder can checkout');
    }

    this.assertCheckoutEligible(ticket);

    const priceCents = ticket.allocation.priceCents ?? 0;
    const feePercent = this.config.get('RALLY_FEE_PERCENT', { infer: true });
    const { feeCents, amountCents, netCents } = computeRallyFee(
      priceCents,
      feePercent,
    );
    const currency = 'usd' as const;
    const metadata = {
      ticketId: ticket.id,
      eventId: ticket.allocation.event.id,
      organizationId: ticket.allocation.event.organizationId,
    };

    const existing = await this.prisma.ticketPayment.findUnique({
      where: { ticketId: ticket.id },
    });

    if (existing?.status === 'requires_payment') {
      let pi = await this.stripe.retrievePaymentIntent(
        existing.stripePaymentIntentId,
      );
      if (pi.amount !== amountCents) {
        pi = await this.stripe.updatePaymentIntentAmount(pi.id, amountCents);
        await this.prisma.ticketPayment.update({
          where: { id: existing.id },
          data: { amountCents, feeCents, netCents, currency },
        });
      }
      if (!pi.client_secret) {
        throw new BadRequestException('PaymentIntent missing client secret');
      }
      return {
        clientSecret: pi.client_secret,
        priceCents,
        feeCents,
        amountCents,
        currency,
      };
    }

    const idempotencyKey = existing
      ? `ticket-checkout-${ticket.id}-${existing.id}-${existing.status}`
      : `ticket-checkout-${ticket.id}`;

    const pi = await this.stripe.createPaymentIntent({
      amountCents,
      currency,
      metadata,
      idempotencyKey,
    });
    if (!pi.client_secret) {
      throw new BadRequestException('PaymentIntent missing client secret');
    }

    if (existing) {
      await this.prisma.ticketPayment.update({
        where: { id: existing.id },
        data: {
          stripePaymentIntentId: pi.id,
          amountCents,
          feeCents,
          netCents,
          currency,
          status: 'requires_payment',
          statusMismatch: false,
        },
      });
    } else {
      await this.prisma.ticketPayment.create({
        data: {
          ticketId: ticket.id,
          stripePaymentIntentId: pi.id,
          amountCents,
          feeCents,
          netCents,
          currency,
          status: 'requires_payment',
        },
      });
    }

    return {
      clientSecret: pi.client_secret,
      priceCents,
      feeCents,
      amountCents,
      currency,
    };
  }

  assertCheckoutEligible(ticket: CheckoutTicketContext): void {
    const { allocation } = ticket;
    const { event } = allocation;

    if (!event.ticketingEnabled) {
      throw new BadRequestException('Ticketing is not enabled for this event');
    }
    if (event.ticketSaleStatus !== 'on_sale') {
      throw new BadRequestException('Ticket sales are not open');
    }
    if (ticket.status === 'void') {
      throw new BadRequestException('Void tickets cannot be checked out');
    }
    if (ticket.status !== 'unpaid') {
      throw new BadRequestException('Only unpaid tickets can be checked out');
    }
    if (allocation.status !== 'active') {
      throw new BadRequestException('Allocation is closed');
    }
    const priceCents = allocation.priceCents ?? 0;
    if (priceCents <= 0) {
      throw new BadRequestException(
        'Free tickets do not require checkout',
      );
    }
    if (!event.organization.stripeChargesEnabled) {
      throw new UnprocessableEntityException({
        code: 'CONNECT_REQUIRED',
        message:
          'Host organization must complete Stripe Connect before checkout',
      });
    }
  }
}
