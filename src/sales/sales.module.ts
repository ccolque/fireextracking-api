import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { ReceiptsModule } from '../receipts/receipts.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [PaymentsModule, ReceiptsModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
