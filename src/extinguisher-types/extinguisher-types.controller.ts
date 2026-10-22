import {
  BadRequestException,
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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLE_ADMIN } from '../common/constants';
import { CreateExtinguisherTypeDto, UpdateExtinguisherTypeDto } from './dto/extinguisher-type.dto';

@ApiTags('extinguisher-types')
@ApiBearerAuth()
@Controller('extinguisher-types')
export class ExtinguisherTypesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Tipos con sus capacidades y precios (lista de precios completa). */
  @Get()
  list() {
    return this.prisma.client.extinguisherType.findMany({
      where: { isDeleted: false },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: {
        capacities: {
          where: { isDeleted: false },
          orderBy: [{ order: 'asc' }, { capacity: 'asc' }],
        },
      },
    });
  }

  @Roles(ROLE_ADMIN)
  @Post()
  async create(@Body() dto: CreateExtinguisherTypeDto, @CurrentUser('userId') actorId: string) {
    const exists = await this.prisma.client.extinguisherType.findUnique({ where: { code: dto.code } });
    if (exists) throw new ConflictException('Ya existe un tipo con ese código');
    return this.prisma.client.extinguisherType.create({ data: { ...dto, createdBy: actorId } });
  }

  @Roles(ROLE_ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExtinguisherTypeDto,
    @CurrentUser('userId') actorId: string,
  ) {
    const type = await this.prisma.client.extinguisherType.findFirst({ where: { id, isDeleted: false } });
    if (!type) throw new NotFoundException('Tipo no encontrado');
    if (dto.unit && dto.unit !== type.unit) {
      const used = await this.prisma.client.extinguisherCapacity.count({ where: { typeId: id, isDeleted: false } });
      if (used) throw new BadRequestException('No se puede cambiar la unidad de un tipo con capacidades cargadas');
    }
    return this.prisma.client.extinguisherType.update({ where: { id }, data: { ...dto, updatedBy: actorId } });
  }

  @Roles(ROLE_ADMIN)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') actorId: string) {
    const type = await this.prisma.client.extinguisherType.findFirst({ where: { id, isDeleted: false } });
    if (!type) throw new NotFoundException('Tipo no encontrado');
    const now = new Date();
    await this.prisma.client.$transaction([
      this.prisma.client.extinguisherCapacity.updateMany({
        where: { typeId: id, isDeleted: false },
        data: { isDeleted: true, deletedAt: now, deletedBy: actorId, isActive: false },
      }),
      this.prisma.client.extinguisherType.update({
        where: { id },
        // Libera el code (unique) para poder reutilizarlo.
        data: {
          isDeleted: true,
          deletedAt: now,
          deletedBy: actorId,
          isActive: false,
          code: `${id.slice(0, 8)}_${Date.now()}`.slice(0, 20),
        },
      }),
    ]);
    return { success: true };
  }
}
