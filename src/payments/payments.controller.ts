import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/payment.dto';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Registra un pago (total o parcial) sobre una venta y devuelve el Recibo de pago emitido. */
  @Post()
  create(@Body() dto: CreatePaymentDto, @CurrentUser('userId') userId: string) {
    return this.payments.create(dto, userId);
  }

  @Get('sale/:saleId')
  listBySale(@Param('saleId', ParseUUIDPipe) saleId: string) {
    return this.payments.listBySale(saleId);
  }
}
