import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLE_ADMIN } from '../common/constants';
import { CreateExtinguisherCapacityDto, UpdateExtinguisherCapacityDto } from './dto/extinguisher-capacity.dto';

class CapacityQueryDto {
  @IsOptional() @IsUUID()
  typeId?: string;
}

@ApiTags('extinguisher-capacities')
@ApiBearerAuth()
@Controller('extinguisher-capacities')
export class ExtinguisherCapacitiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query() q: CapacityQueryDto) {
    return this.prisma.client.extinguisherCapacity.findMany({
      where: { isDeleted: false, ...(q.typeId ? { typeId: q.typeId } : {}) },
      orderBy: [{ type: { order: 'asc' } }, { capacity: 'asc' }],
      include: { type: { select: { id: true, code: true, name: true, unit: true } } },
    });
  }

  @Roles(ROLE_ADMIN)
  @Post()
  async create(@Body() dto: CreateExtinguisherCapacityDto, @CurrentUser('userId') actorId: string) {
    const type = await this.prisma.client.extinguisherType.findFirst({ where: { id: dto.typeId, isDeleted: false } });
    if (!type) throw new NotFoundException('Tipo no encontrado');
    const dup = await this.prisma.client.extinguisherCapacity.findFirst({
      where: { typeId: dto.typeId, capacity: dto.capacity, isDeleted: false },
    });
    if (dup) throw new ConflictException('Esa capacidad ya existe para el tipo');
    return this.prisma.client.extinguisherCapacity.create({ data: { ...dto, createdBy: actorId } });
  }

  /** Tambien se usa para cargar/actualizar precios de venta y recarga. */
  @Roles(ROLE_ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExtinguisherCapacityDto,
    @CurrentUser('userId') actorId: string,
  ) {
    const cap = await this.prisma.client.extinguisherCapacity.findFirst({ where: { id, isDeleted: false } });
    if (!cap) throw new NotFoundException('Capacidad no encontrada');
    return this.prisma.client.extinguisherCapacity.update({ where: { id }, data: { ...dto, updatedBy: actorId } });
  }

  @Roles(ROLE_ADMIN)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') actorId: string) {
    const cap = await this.prisma.client.extinguisherCapacity.findFirst({ where: { id, isDeleted: false } });
    if (!cap) throw new NotFoundException('Capacidad no encontrada');
    // capacity = 0 libera el unique (type_id, capacity) para poder volver a cargarla.
    await this.prisma.client.extinguisherCapacity.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: actorId, isActive: false, capacity: 0 },
    });
    return { success: true };
  }
}
