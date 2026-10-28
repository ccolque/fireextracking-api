import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginated } from '../common/dto/pagination-query.dto';
import { capacityLabel } from '../common/utils/labels';
import { requiresLicensePlate } from '../common/utils/license-plate';
import { customerDisplayName, isValidCuit, normalizeCuit } from '../common/utils/customer';
import { CreateCustomerDto, CustomerQueryDto, UpdateCustomerDto } from './dto/customer.dto';

const clean = (v?: string | null) => (v === undefined ? undefined : v?.trim() || null);

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: CustomerQueryDto) {
    const where: Prisma.CustomerWhereInput = {
      isDeleted: false,
      ...(q.customerType ? { customerType: q.customerType } : {}),
    };
    const words = q.search?.trim().split(/\s+/).filter(Boolean) ?? [];
    if (words.length) {
      where.AND = words.map((w) => {
        const digits = normalizeCuit(w);
        return {
          OR: [
            { displayName: { contains: w, mode: 'insensitive' } },
            { phone: { contains: w } },
            ...(digits ? [{ cuit: { contains: digits } }] : []),
          ],
        } satisfies Prisma.CustomerWhereInput;
      });
    }
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.customer.findMany({
        where,
        orderBy: { displayName: 'asc' },
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
          include: { capacity: { include: { type: true } }, brand: { select: { id: true, name: true } } },
        },
      },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  /** Todos los matafuegos del cliente (sin paginar), para elegir en una recarga. */
  async extinguishers(id: string) {
    const customer = await this.prisma.client.customer.findFirst({
      where: { id, isDeleted: false },
      select: { id: true },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    const rows = await this.prisma.client.extinguisher.findMany({
      where: { customerId: id, isDeleted: false },
      include: {
        capacity: { include: { type: true } },
        brand: { select: { id: true, name: true } },
        reminders: {
          where: { isDeleted: false },
          orderBy: { dueDate: 'desc' },
          take: 1,
          select: { dueDate: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(({ reminders, ...e }) => ({
      ...e,
      label: capacityLabel(e.capacity.type.name, e.capacity.capacity, e.capacity.type.unit),
      requiresLicensePlate: requiresLicensePlate(e.capacity.type.unit, e.capacity.capacity),
      lastDueDate: reminders[0]?.dueDate ?? null,
    }));
  }

  async create(dto: CreateCustomerDto, actorId: string) {
    const data = this.normalize(dto);
    // Una empresa no tiene nombre ni apellido: solo razon social.
    if (data.customerType === CustomerType.COMPANY) {
      data.firstName = null;
      data.lastName = null;
    }
    await this.assertRules(data);
    await this.assertCuitFree(data.cuit);
    return this.prisma.client.customer.create({
      data: {
        ...data,
        phone: dto.phone,
        displayName: customerDisplayName({
          customerType: data.customerType ?? CustomerType.PERSON,
          firstName: data.firstName ?? null,
          lastName: data.lastName ?? null,
          businessName: data.businessName ?? null,
        }),
        createdBy: actorId,
      },
    });
  }

  async update(id: string, dto: UpdateCustomerDto, actorId: string) {
    const current = await this.findOne(id);
    const patch = this.normalize(dto);
    const merged = {
      customerType: patch.customerType ?? current.customerType,
      firstName: patch.firstName !== undefined ? patch.firstName : current.firstName,
      lastName: patch.lastName !== undefined ? patch.lastName : current.lastName,
      businessName: patch.businessName !== undefined ? patch.businessName : current.businessName,
      cuit: patch.cuit !== undefined ? patch.cuit : current.cuit,
    };
    // Una persona no tiene razon social.
    if (merged.customerType === CustomerType.PERSON) {
      merged.businessName = null;
      patch.businessName = null;
    }
    // Una empresa no tiene nombre ni apellido: solo razon social.
    if (merged.customerType === CustomerType.COMPANY) {
      merged.firstName = merged.lastName = null;
      patch.firstName = patch.lastName = null;
    }
    await this.assertRules(merged);
    if (patch.cuit !== undefined && patch.cuit !== current.cuit) await this.assertCuitFree(patch.cuit, id);

    return this.prisma.client.customer.update({
      where: { id },
      data: { ...patch, displayName: customerDisplayName(merged), updatedBy: actorId },
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

  /** Recorta textos, pasa vacios a null y deja el CUIT solo con digitos. */
  private normalize(dto: CreateCustomerDto | UpdateCustomerDto) {
    const cuit = clean(dto.cuit);
    return {
      ...dto,
      firstName: clean(dto.firstName),
      lastName: clean(dto.lastName),
      businessName: clean(dto.businessName),
      address: clean(dto.address),
      email: clean(dto.email),
      notes: clean(dto.notes),
      cuit: cuit ? normalizeCuit(cuit) : cuit,
    };
  }

  private async assertRules(c: {
    customerType?: CustomerType;
    firstName?: string | null;
    lastName?: string | null;
    businessName?: string | null;
    cuit?: string | null;
  }) {
    const type = c.customerType ?? CustomerType.PERSON;
    const errors: string[] = [];
    if (type === CustomerType.PERSON) {
      if (!c.firstName) errors.push('El nombre es obligatorio para personas');
      if (!c.lastName) errors.push('El apellido es obligatorio para personas');
    } else {
      if (!c.businessName) errors.push('La razón social es obligatoria para empresas');
      if (!c.cuit) errors.push('El CUIT es obligatorio para empresas');
    }
    if (c.cuit && !isValidCuit(c.cuit)) errors.push('El CUIT no es válido');
    if (errors.length) throw new BadRequestException(errors);
  }

  private async assertCuitFree(cuit?: string | null, exceptId?: string) {
    if (!cuit) return;
    const dup = await this.prisma.client.customer.findFirst({
      where: { cuit, isDeleted: false, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true },
    });
    if (dup) throw new ConflictException('Ya existe un cliente con ese CUIT');
  }
}
