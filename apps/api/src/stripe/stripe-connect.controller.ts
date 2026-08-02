import {
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequireOrgPermission } from '../permissions/decorators/require-org-permission.decorator';
import { OrgPermissionGuard } from '../permissions/guards/org-permission.guard';
import { StripeConnectService } from './stripe-connect.service';
import {
  OrgStripeParamsSchema,
  StripeConnectOnboardingLinkResponseSchema,
  StripeConnectRefreshLinkResponseSchema,
  StripeConnectReturnSyncResponseSchema,
  StripeConnectStatusResponseSchema,
  type OrgStripeParams,
  type StripeConnectOnboardingLinkResponse,
  type StripeConnectRefreshLinkResponse,
  type StripeConnectReturnSyncResponse,
  type StripeConnectStatusResponse,
} from './types/stripe-connect.dto';

@Controller('organizations/:organizationId/stripe')
@UseGuards(OrgPermissionGuard)
@RequireOrgPermission('payments.manage', {
  organizationIdParam: 'organizationId',
})
export class StripeConnectController {
  constructor(private readonly connect: StripeConnectService) {}

  @Get('status')
  async status(
    @Param(new ZodValidationPipe(OrgStripeParamsSchema))
    params: OrgStripeParams,
  ): Promise<StripeConnectStatusResponse> {
    return StripeConnectStatusResponseSchema.parse(
      await this.connect.getStatus(params.organizationId),
    );
  }

  @Post('connect')
  async connectOnboarding(
    @Param(new ZodValidationPipe(OrgStripeParamsSchema))
    params: OrgStripeParams,
  ): Promise<StripeConnectOnboardingLinkResponse> {
    return StripeConnectOnboardingLinkResponseSchema.parse(
      await this.connect.startConnect(params.organizationId),
    );
  }

  @Get('refresh')
  async refresh(
    @Param(new ZodValidationPipe(OrgStripeParamsSchema))
    params: OrgStripeParams,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.connect.refreshOnboarding(params.organizationId);
    res.redirect(303, url);
  }

  @Get('return')
  async returnFromStripe(
    @Param(new ZodValidationPipe(OrgStripeParamsSchema))
    params: OrgStripeParams,
    @Res() res: Response,
  ): Promise<void> {
    const url = await this.connect.handleReturn(params.organizationId);
    res.redirect(303, url);
  }

  /** FE bridge companion: sync + JSON (Bearer), avoids opaque 303 Location. */
  @Post('return/sync')
  async returnSync(
    @Param(new ZodValidationPipe(OrgStripeParamsSchema))
    params: OrgStripeParams,
  ): Promise<StripeConnectReturnSyncResponse> {
    const redirectTo = await this.connect.handleReturn(params.organizationId);
    return StripeConnectReturnSyncResponseSchema.parse({ redirectTo });
  }

  /** FE bridge companion: mint link as JSON (Bearer). */
  @Post('refresh/link')
  async refreshLink(
    @Param(new ZodValidationPipe(OrgStripeParamsSchema))
    params: OrgStripeParams,
  ): Promise<StripeConnectRefreshLinkResponse> {
    const url = await this.connect.refreshOnboarding(params.organizationId);
    return StripeConnectRefreshLinkResponseSchema.parse({ url });
  }
}