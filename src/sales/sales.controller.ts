import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLE_ADMIN } from '../common/constants';
import { SalesService } from './sales.service';
import { CreateSaleDto, SaleQueryDto } from './dto/sale.dto';

@ApiTags('sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  /**
   * Registra la venta: crea envases si hacen falta, fecha de carga/vencimiento,
   * avisos de renovación, Factura X y (opcional) el primer pago con su Recibo.
   */
  @Post()
  create(@Body() dto: CreateSaleDto, @CurrentUser('userId') userId: string) {
    return this.sales.create(dto, userId);
  }

  @Get()
  list(@Query() q: SaleQueryDto) {
    return this.sales.list(q);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.findOne(id);
  }

  @Roles(ROLE_ADMIN)
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('userId') userId: string,
    @CurrentUser('userName') userName: string,
  ) {
    return this.sales.cancel(id, userId, userName);
  }
}
