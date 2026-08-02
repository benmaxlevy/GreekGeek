import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Organization } from '@prisma/client';
import type { Env } from '../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import type {
  StripeConnectOnboardingLinkResponse,
  StripeConnectStatusResponse,
} from './types/stripe-connect.dto';
import { StripeService } from './stripe.service';
import { syncOrgFromStripeAccount } from './stripe-sync';

type OrgStripeRow = Pick<
  Organization,
  | 'id'
  | 'name'
  | 'stripeAccountId'
  | 'stripeChargesEnabled'
  | 'stripePayoutsEnabled'
  | 'stripeTransfersEnabled'
  | 'stripeDetailsSubmitted'
  | 'stripeRequirementsDue'
  | 'stripeAccountUpdatedAt'
>;

@Injectable()
export class StripeConnectService {
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    config: ConfigService<Env, true>,
  ) {
    this.appUrl = config.get('APP_URL', { infer: true }).replace(/\/$/, '');
  }

  /** FE bridge routes (auth + bearer); Stripe must not hit JWT-only API GETs. */
  connectReturnUrl(organizationId: string): string {
    return `${this.appUrl}/app/orgs/${organizationId}/payments/return`;
  }

  connectRefreshUrl(organizationId: string): string {
    return `${this.appUrl}/app/orgs/${organizationId}/payments/refresh`;
  }

  paymentsSettingsUrl(organizationId: string): string {
    return `${this.appUrl}/app/orgs/${organizationId}/payments`;
  }

  async getStatus(organizationId: string): Promise<StripeConnectStatusResponse> {
    const org = await this.requireOrg(organizationId);
    return this.toStatus(org);
  }

  /**
   * Idempotent Connect start: reuse stripeAccountId or create Express account,
   * persist id before minting account_link, return hosted URL.
   */
  async startConnect(
    organizationId: string,
    contactEmail: string,
  ): Promise<StripeConnectOnboardingLinkResponse> {
    const accountId = await this.ensureStripeAccountId(organizationId, contactEmail);
    const org = await this.requireOrg(organizationId);
    const link = await this.mintAccountLink(org, accountId);
    return { url: link.url };
  }

  /** Mint fresh account_link for expired/used link recovery. */
  async refreshOnboarding(organizationId: string): Promise<string> {
    const org = await this.requireOrg(organizationId);
    if (!org.stripeAccountId) {
      throw new BadRequestException('Organization has no Stripe account');
    }
    const link = await this.mintAccountLink(org, org.stripeAccountId);
    return link.url;
  }

  /**
   * Refetch Stripe account, sync org flags, return payments settings URL.
   * Redirect alone is never treated as ready — flags come from Stripe data.
   */
  async handleReturn(organizationId: string): Promise<string> {
    const org = await this.requireOrg(organizationId);
    if (!org.stripeAccountId) {
      throw new BadRequestException('Organization has no Stripe account');
    }
    const account = await this.stripe.retrieveAccount(org.stripeAccountId);
    await syncOrgFromStripeAccount(this.prisma, organizationId, account);
    return this.paymentsSettingsUrl(organizationId);
  }

  private async ensureStripeAccountId(
    organizationId: string,
    contactEmail: string,
  ): Promise<string> {
    return this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<
          Array<{ id: string; name: string; stripeAccountId: string | null }>
        >`
          SELECT id, name, "stripeAccountId"
          FROM "Organization"
          WHERE id = ${organizationId}
          FOR UPDATE
        `;
        const org = locked[0];
        if (!org) {
          throw new NotFoundException('Organization not found');
        }
        if (org.stripeAccountId) {
          return org.stripeAccountId;
        }

        const account = await this.stripe.createConnectAccount({
          displayName: org.name,
          organizationId: org.id,
          contactEmail,
        });

        await tx.organization.update({
          where: { id: org.id },
          data: { stripeAccountId: account.id },
        });

        return account.id;
      },
      { timeout: 30_000 },
    );
  }

  private async mintAccountLink(org: OrgStripeRow, accountId: string): Promise<{ url: string }> {
    const useCaseType =
      org.stripeDetailsSubmitted && this.hasOutstandingRequirements(org.stripeRequirementsDue)
        ? 'account_update'
        : 'account_onboarding';

    return this.stripe.createAccountLink({
      accountId,
      useCaseType,
      returnUrl: this.connectReturnUrl(org.id),
      refreshUrl: this.connectRefreshUrl(org.id),
    });
  }

  private hasOutstandingRequirements(requirementsDue: unknown): boolean {
    if (requirementsDue == null) {
      return false;
    }
    if (typeof requirementsDue !== 'object') {
      return false;
    }
    const entries = (requirementsDue as { entries?: unknown }).entries;
    return Array.isArray(entries) && entries.length > 0;
  }

  private async requireOrg(organizationId: string): Promise<OrgStripeRow> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeTransfersEnabled: true,
        stripeDetailsSubmitted: true,
        stripeRequirementsDue: true,
        stripeAccountUpdatedAt: true,
      },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  private toStatus(org: OrgStripeRow): StripeConnectStatusResponse {
    return {
      stripeAccountId: org.stripeAccountId,
      stripeChargesEnabled: org.stripeChargesEnabled,
      stripePayoutsEnabled: org.stripePayoutsEnabled,
      stripeTransfersEnabled: org.stripeTransfersEnabled,
      stripeDetailsSubmitted: org.stripeDetailsSubmitted,
      stripeRequirementsDue: org.stripeRequirementsDue ?? null,
      stripeAccountUpdatedAt: org.stripeAccountUpdatedAt
        ? org.stripeAccountUpdatedAt.toISOString()
        : null,
    };
  }
}
