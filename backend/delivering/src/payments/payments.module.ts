import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsResolver } from './payments.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { StripeProvider } from './providers/stripe.provider';

@Module({
  imports: [PrismaModule],
  providers: [PaymentsService, PaymentsResolver, StripeProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
