import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductKind, StockMovementReason } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, paginated } from '../common/dto/pagination-query.dto';
import { capacityLabel } from '../common/utils/labels';
import { requiresLicensePlate } from '../common/utils/license-plate';
import {
  CreateProductDto,
  KitItemDto,
  ProductQueryDto,
  StockAdjustDto,
  UpdateProductDto,
} from './dto/product.dto';

const TX_OPTIONS = { maxWait: 10000, timeout: 30000 };

export const PRODUCT_INCLUDE = {
  brand: { select: { id: true, name: true } },
  kitItems: {
    orderBy: { createdAt: 'asc' },
    include: {
      product: { select: { id: true, name: true, price: true, stock: true, isActive: true } },
      capacity: { include: { type: true } },
    },
  },
} satisfies Prisma.ProductInclude;

type ProductRow = Prisma.ProductGetPayload<{ include: typeof PRODUCT_INCLUDE }>;

/** Agrega `availableStock` y `items` legibles. Kit: componente mas escaso (null si no depende de stock). */
export function presentProduct(p: ProductRow) {
  const { kitItems, ...rest } = p;
  let availableStock: number | null = p.stock;
  if (p.kind === ProductKind.KIT) {
    const limits = kitItems
      .filter((k) => k.product)
      .map((k) => Math.floor((k.product!.stock ?? 0) / k.quantity));
    availableStock = limits.length ? Math.min(...limits) : null;
  }
  return {
    ...rest,
    availableStock,
    items: kitItems.map((k) => ({
      id: k.id,
      quantity: k.quantity,
      product: k.product,
      capacity: k.capacity
        ? {
            id: k.capacity.id,
            label: capacityLabel(k.capacity.type.name, k.capacity.capacity, k.capacity.type.unit),
            requiresLicensePlate: requiresLicensePlate(k.capacity.type.unit, k.capacity.capacity),
          }
        : null,
    })),
  };
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ProductQueryDto) {
    const search = q.search?.trim();
    const where: Prisma.ProductWhereInput = {
      isDeleted: false,
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.brandId ? { brandId: q.brandId } : {}),
      ...(q.activeOnly === 'true' ? { isActive: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { brand: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { name: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.client.product.count({ where }),
    ]);
    return paginated(data.map(presentProduct), total, q);
  }

  async findOne(id: string) {
    const product = await this.prisma.client.product.findFirst({
      where: { id, isDeleted: false },
      include: PRODUCT_INCLUDE,
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return presentProduct(product);
  }

  async create(dto: CreateProductDto, actorId: string) {
    const kind = dto.kind ?? ProductKind.PRODUCT;
    const name = dto.name.trim();
    await this.assertNameFree(name);
    await this.assertBrand(dto.brandId);

    if (kind === ProductKind.PRODUCT) {
      if (dto.stock === undefined) throw new BadRequestException('El stock es obligatorio para productos');
      if (dto.items?.length) throw new BadRequestException('Solo los kits llevan componentes');
    } else {
      if (!dto.items?.length) throw new BadRequestException('El kit necesita al menos un componente');
      await this.assertKitItems(dto.items);
    }

    const created = await this.prisma.client.product.create({
      data: {
        kind,
        name,
        price: dto.price,
        stock: kind === ProductKind.PRODUCT ? dto.stock : null,
        brandId: dto.brandId,
        isActive: dto.isActive,
        createdBy: actorId,
        ...(kind === ProductKind.KIT
          ? { kitItems: { create: this.kitItemsData(dto.items!, actorId) } }
          : dto.stock
            ? {
                stockMovements: {
                  create: {
                    delta: dto.stock,
                    stockAfter: dto.stock,
                    reason: StockMovementReason.INITIAL,
                    createdBy: actorId,
                  },
                },
              }
            : {}),
      },
      include: PRODUCT_INCLUDE,
    });
    return presentProduct(created);
  }

  async update(id: string, dto: UpdateProductDto, actorId: string) {
    const current = await this.findRow(id);
    const name = dto.name?.trim();
    if (name) await this.assertNameFree(name, id);
    if (dto.brandId) await this.assertBrand(dto.brandId);

    if (dto.items) {
      if (current.kind !== ProductKind.KIT) throw new BadRequestException('Solo los kits llevan componentes');
      await this.assertKitItems(dto.items);
    }

    const updated = await this.prisma.client.product.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.brandId !== undefined ? { brandId: dto.brandId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.items ? { kitItems: { deleteMany: {}, create: this.kitItemsData(dto.items, actorId) } } : {}),
        updatedBy: actorId,
      },
      include: PRODUCT_INCLUDE,
    });
    return presentProduct(updated);
  }

  async remove(id: string, actorId: string) {
    await this.findRow(id);
    const kits = await this.prisma.client.productKitItem.findMany({
      where: { productId: id, kit: { isDeleted: false } },
      select: { kit: { select: { name: true } } },
    });
    if (kits.length) {
      const names = [...new Set(kits.map((k) => `"${k.kit.name}"`))].join(', ');
      throw new ConflictException(`No se puede eliminar: está incluido en los kits ${names}`);
    }
    await this.prisma.client.product.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: actorId, isActive: false },
    });
    return { success: true };
  }

  /** Ajuste manual de stock (carga de mercaderia, correcciones). */
  async adjustStock(id: string, dto: StockAdjustDto, actorId: string) {
    if (dto.delta === 0) throw new BadRequestException('El ajuste no puede ser 0');
    const product = await this.findRow(id);
    if (product.kind !== ProductKind.PRODUCT) {
      throw new BadRequestException('Los kits no tienen stock propio: ajustá el de sus componentes');
    }
    await this.prisma.client.$transaction(async (tx) => {
      const res = await tx.product.updateMany({
        where: { id, ...(dto.delta < 0 ? { stock: { gte: -dto.delta } } : {}) },
        data: { stock: { increment: dto.delta }, updatedBy: actorId },
      });
      if (!res.count) throw new BadRequestException('No hay stock suficiente para restar esa cantidad');
      const after = await tx.product.findUniqueOrThrow({ where: { id }, select: { stock: true } });
      await tx.stockMovement.create({
        data: {
          productId: id,
          delta: dto.delta,
          stockAfter: after.stock ?? 0,
          reason: StockMovementReason.ADJUSTMENT,
          notes: dto.notes,
          createdBy: actorId,
        },
      });
    }, TX_OPTIONS);
    return this.findOne(id);
  }

  async movements(id: string, q: PaginationQueryDto) {
    await this.findRow(id);
    const where = { productId: id };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.client.stockMovement.count({ where }),
    ]);
    return paginated(data, total, q);
  }

  private async findRow(id: string) {
    const p = await this.prisma.client.product.findFirst({ where: { id, isDeleted: false } });
    if (!p) throw new NotFoundException('Producto no encontrado');
    return p;
  }

  private kitItemsData(items: KitItemDto[], actorId: string) {
    return items.map((i) => ({
      productId: i.productId ?? null,
      capacityId: i.capacityId ?? null,
      quantity: i.quantity,
      createdBy: actorId,
    }));
  }

  /** Cada componente es un producto simple o un matafuego, sin repetidos. */
  private async assertKitItems(items: KitItemDto[]) {
    const seen = new Set<string>();
    for (const i of items) {
      if (!!i.productId === !!i.capacityId) {
        throw new BadRequestException('Cada componente del kit debe indicar productId o capacityId (uno solo)');
      }
      const key = i.productId ?? i.capacityId!;
      if (seen.has(key)) throw new BadRequestException('El kit tiene un componente repetido');
      seen.add(key);
    }
    const productIds = items.filter((i) => i.productId).map((i) => i.productId!);
    if (productIds.length) {
      const found = await this.prisma.client.product.findMany({
        where: { id: { in: productIds }, isDeleted: false },
        select: { id: true, kind: true },
      });
      if (found.length !== productIds.length) throw new NotFoundException('Un producto del kit no existe');
      if (found.some((f) => f.kind === ProductKind.KIT)) {
        throw new BadRequestException('Un kit no puede incluir otros kits');
      }
    }
    const capacityIds = items.filter((i) => i.capacityId).map((i) => i.capacityId!);
    if (capacityIds.length) {
      const count = await this.prisma.client.extinguisherCapacity.count({
        where: { id: { in: capacityIds }, isDeleted: false },
      });
      if (count !== capacityIds.length) throw new NotFoundException('Un matafuego del kit no existe');
    }
  }

  private async assertBrand(brandId?: string) {
    if (!brandId) return;
    const b = await this.prisma.client.brand.findFirst({
      where: { id: brandId, isDeleted: false },
      select: { id: true },
    });
    if (!b) throw new NotFoundException('Marca no encontrada');
  }

  private async assertNameFree(name: string, exceptId?: string) {
    const dup = await this.prisma.client.product.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        isDeleted: false,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (dup) throw new ConflictException('Ya existe un producto o kit con ese nombre');
  }
}
