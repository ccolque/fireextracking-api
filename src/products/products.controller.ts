import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLE_ADMIN } from '../common/constants';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ProductsService } from './products.service';
import { CreateProductDto, ProductQueryDto, StockAdjustDto, UpdateProductDto } from './dto/product.dto';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** Productos y kits. ?search (nombre o marca), ?kind, ?brandId, ?activeOnly=true. */
  @Get()
  list(@Query() q: ProductQueryDto) {
    return this.products.list(q);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.findOne(id);
  }

  @Roles(ROLE_ADMIN)
  @Post()
  create(@Body() dto: CreateProductDto, @CurrentUser('userId') actorId: string) {
    return this.products.create(dto, actorId);
  }

  @Roles(ROLE_ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.products.update(id, dto, actorId);
  }

  @Roles(ROLE_ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') actorId: string) {
    return this.products.remove(id, actorId);
  }

  /** Suma (delta > 0) o resta (delta < 0) stock y deja el movimiento. */
  @Roles(ROLE_ADMIN)
  @Post(':id/stock')
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StockAdjustDto,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.products.adjustStock(id, dto, actorId);
  }

  @Roles(ROLE_ADMIN)
  @Get(':id/stock-movements')
  movements(@Param('id', ParseUUIDPipe) id: string, @Query() q: PaginationQueryDto) {
    return this.products.movements(id, q);
  }
}
