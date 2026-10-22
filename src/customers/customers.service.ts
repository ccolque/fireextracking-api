import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, paginated } from '../common/dto/pagination-query.dto';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: PaginationQueryDto) {
    const where: Prisma.CustomerWhereInput = { isDeleted: false };
    const words = q.search?.trim().split(/\s+/).filter(Boolean) ?? [];
    if (words.length) {
      where.AND = words.map((w) => ({
        OR: [
          { firstName: { contains: w, mode: 'insensitive' } },
          { lastName: { contains: w, mode: 'insensitive' } },
          { phone: { contains: w } },
        ],
      }));
    }
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.customer.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.client.customer.count({ where }),
    ]);
    return paginated(data, total, q);
  }

  async findOne(id: string) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id, isDeleted: false },
      include: {
        extinguishers: {
          where: { isDeleted: false },
          include: { capacity: { include: { type: true } } },
        },
      },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  create(dto: CreateCustomerDto, actorId: string) {
    return this.prisma.client.customer.create({
      data: { ...dto, createdBy: actorId },
    });
  }

  async update(id: string, dto: UpdateCustomerDto, actorId: string) {
    await this.findOne(id);
    return this.prisma.client.customer.update({
      where: { id },
      data: { ...dto, updatedBy: actorId },
    });
  }

  async remove(id: string, actorId: string) {
    await this.findOne(id);
    await this.prisma.client.customer.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: actorId },
    });
    return { success: true };
  }
}
