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
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLE_ADMIN } from '../common/constants';
import { PaginationQueryDto, paginated } from '../common/dto/pagination-query.dto';
import { CreateBrandDto, UpdateBrandDto } from './dto/brand.dto';

@ApiTags('brands')
@ApiBearerAuth()
@Controller('brands')
export class BrandsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Marcas ordenadas por nombre. ?search filtra por nombre (para autocompletar). */
  @Get()
  async list(@Query() q: PaginationQueryDto) {
    const where = {
      isDeleted: false,
      ...(q.search?.trim() ? { name: { contains: q.search.trim(), mode: 'insensitive' as const } } : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.brand.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.client.brand.count({ where }),
    ]);
    return paginated(data, total, q);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.find(id);
  }

  /** Cualquier usuario puede dar de alta una marca faltante durante una venta. */
  @Post()
  async create(@Body() dto: CreateBrandDto, @CurrentUser('userId') actorId: string) {
    const name = dto.name.trim();
    await this.assertNameFree(name);
    return this.prisma.client.brand.create({ data: { name, createdBy: actorId } });
  }

  @Roles(ROLE_ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBrandDto,
    @CurrentUser('userId') actorId: string,
  ) {
    await this.find(id);
    const name = dto.name?.trim();
    if (name) await this.assertNameFree(name, id);
    return this.prisma.client.brand.update({ where: { id }, data: { ...(name ? { name } : {}), updatedBy: actorId } });
  }

  /** Baja logica: los matafuegos que la tenian siguen mostrandola. */
  @Roles(ROLE_ADMIN)
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('userId') actorId: string) {
    await this.find(id);
    await this.prisma.client.brand.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: actorId },
    });
    return { success: true };
  }

  private async find(id: string) {
    const brand = await this.prisma.client.brand.findFirst({ where: { id, isDeleted: false } });
    if (!brand) throw new NotFoundException('Marca no encontrada');
    return brand;
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const dup = await this.prisma.client.brand.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, isDeleted: false, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (dup) throw new ConflictException('Ya existe una marca con ese nombre');
  }
}
