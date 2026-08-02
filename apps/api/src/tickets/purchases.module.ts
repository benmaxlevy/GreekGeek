import { Module } from '@nestjs/common';
import { StripeModule } from '../stripe/stripe.module';
import { PurchasesService } from './purchases.service';

@Module({
  imports: [StripeModule],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
