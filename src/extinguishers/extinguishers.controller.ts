import {
  Body,
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
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLE_ADMIN } from '../common/constants';
import { paginated } from '../common/dto/pagination-query.dto';
import { CUSTOMER_NAME_SELECT } from '../common/utils/customer';
import { normalizeLicensePlate } from '../common/utils/license-plate';
import { CreateExtinguisherDto, ExtinguisherQueryDto, UpdateExtinguisherDto } from './dto/extinguisher.dto';

const INCLUDE = {
  capacity: { include: { type: true } },
  brand: { select: { id: true, name: true } },
  customer: { select: CUSTOMER_NAME_SELECT },
} satisfies Prisma.ExtinguisherInclude;

function toDates(dto: { manufactureDate?: string; hydraulicTestDueDate?: string }) {
  return {
    ...(dto.manufactureDate ? { manufactureDate: new Date(dto.manufactureDate) } : {}),
    ...(dto.hydraulicTestDueDate ? { hydraulicTestDueDate: new Date(dto.hydraulicTestDueDate) } : {}),
  };
}

@ApiTags('extinguishers')
@ApiBearerAuth()
@Controller('extinguishers')
export class ExtinguishersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * ?search busca por Nº de serie o por cliente (nombre/razón social, varias palabras);
   * ?customerId filtra por dueño.
   */
  @Get()
  async list(@Query() q: ExtinguisherQueryDto) {
    const where: Prisma.ExtinguisherWhereInput = {
      isDeleted: false,
      ...(q.customerId ? { customerId: q.customerId } : {}),
    };
    const search = q.search?.trim();
    if (search) {
      const words = search.split(/\s+/);
      where.OR = [
        { serialNumber: { contains: search, mode: 'insensitive' } },
        { AND: words.map((w) => ({ customer: { displayName: { contains: w, mode: 'insensitive' as const } } })) },
      ];
    }
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.extinguisher.findMany({
        where,
        include: INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.client.extinguisher.count({ where }),
    ]);
    return paginated(data, total, q);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const ext = await this.prisma.client.extinguisher.findFirst({
      where: { id, isDeleted: false },
      include: INCLUDE,
    });
    if (!ext) throw new NotFoundException('Matafuego no encontrado');
    return ext;
  }

  @Roles(ROLE_ADMIN)
  @Post()
  create(@Body() dto: CreateExtinguisherDto, @CurrentUser('userId') actorId: string) {
    const { manufactureDate, hydraulicTestDueDate, licensePlate, ...rest } = dto;
    return this.prisma.client.extinguisher.create({
      data: {
        ...rest,
        licensePlate: normalizeLicensePlate(licensePlate),
        ...toDates({ manufactureDate, hydraulicTestDueDate }),
        createdBy: actorId,
      },
      include: INCLUDE,
    });
  }

  @Roles(ROLE_ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExtinguisherDto,
    @CurrentUser('userId') actorId: string,
  ) {
    await this.findOne(id);
    const { manufactureDate, hydraulicTestDueDate, licensePlate, ...rest } = dto;
    return this.prisma.client.extinguisher.update({
      where: { id },
      data: {
        ...rest,
        ...(licensePlate !== undefined ? { licensePlate: normalizeLicensePlate(licensePlate) ?? null } : {}),
        ...toDates({ manufactureDate, hydraulicTestDueDate }),
        updatedBy: actorId,
      },
      include: INCLUDE,
    });
  }

  @Roles(ROLE_ADMIN)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') actorId: string) {
    await this.findOne(id);
    await this.prisma.client.extinguisher.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: actorId },
    });
    return { success: true };
  }
}
