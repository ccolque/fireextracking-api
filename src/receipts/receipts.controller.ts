import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ReceiptsService } from './receipts.service';

class ReceiptQueryDto {
  @IsOptional() @IsUUID()
  saleId?: string;
}

@ApiTags('receipts')
@ApiBearerAuth()
@Controller('receipts')
export class ReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  @Get()
  list(@Query() q: ReceiptQueryDto) {
    return this.receipts.list(q.saleId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.receipts.findOne(id);
  }
}
