import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { PublicUser } from '../auth/types/auth.dto';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PurchasesService } from './purchases.service';
import {
  PurchaseCheckoutRequestSchema,
  PurchaseCheckoutResponseSchema,
  type PurchaseCheckoutRequest,
  type PurchaseCheckoutResponse,
} from './types/purchase.dto';

@Controller('ticket-purchases')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post('checkout')
  async checkout(
    @Body(new ZodValidationPipe(PurchaseCheckoutRequestSchema))
    body: PurchaseCheckoutRequest,
    @CurrentUser() caller: PublicUser,
  ): Promise<PurchaseCheckoutResponse> {
    return PurchaseCheckoutResponseSchema.parse(
      await this.purchasesService.checkout(body, caller),
    );
  }
}
