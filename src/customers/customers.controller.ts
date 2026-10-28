import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLE_ADMIN } from '../common/constants';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, CustomerQueryDto, UpdateCustomerDto } from './dto/customer.dto';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  /** Busqueda por nombre, apellido, razon social, CUIT o telefono (?search=juan perez). */
  @Get()
  list(@Query() q: CustomerQueryDto) {
    return this.customers.list(q);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.findOne(id);
  }

  /** Matafuegos que ya tiene el cliente (sin paginar): para armar una recarga. */
  @Get(':id/extinguishers')
  extinguishers(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.extinguishers(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto, @CurrentUser('userId') actorId: string) {
    return this.customers.create(dto, actorId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.customers.update(id, dto, actorId);
  }

  @Roles(ROLE_ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') actorId: string) {
    return this.customers.remove(id, actorId);
  }
}
