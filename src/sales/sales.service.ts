import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ExtinguisherStatus,
  Prisma,
  ProductKind,
  ReceiptType,
  ReminderStatus,
  SaleItemType,
  SaleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessSettingsService } from '../business-settings/business-settings.service';
import { PaymentsService } from '../payments/payments.service';
import { ReceiptsService } from '../receipts/receipts.service';
import { paginated } from '../common/dto/pagination-query.dto';
import { addDays, addMonths, todayLocal } from '../common/utils/dates';
import { capacityLabel } from '../common/utils/labels';
import { normalizeLicensePlate, requiresLicensePlate } from '../common/utils/license-plate';
import { CUSTOMER_NAME_SELECT } from '../common/utils/customer';
import { returnStock, takeStock } from '../products/stock.util';
import { CreateSaleDto, CreateSaleItemDto, KitExtinguisherDto, SaleQueryDto } from './dto/sale.dto';

// Las ventas con varios items hacen muchas consultas; el default de Prisma (5 s) no alcanza con BD remota.
const TX_OPTIONS = { maxWait: 10000, timeout: 60000 };

interface ItemContext {
  sale: { id: string };
  customer: Prisma.CustomerGetPayload<object>;
  userId: string;
  chargeDate: Date;
  expirationDate: Date;
  notifyFrom: Date;
}

interface ExtinguisherItemInput {
  itemType: SaleItemType;
  capacityId?: string;
  extinguisherId?: string;
  serialNumber?: string;
  brandId?: string;
  licensePlate?: string;
  manufactureDate?: string;
  hydraulicTestDueDate?: string;
  description?: string;
  unitPrice?: number;
}

type CatalogProduct = Prisma.ProductGetPayload<{
  include: {
    kitItems: { include: { product: { select: { id: true; name: true } }; capacity: { include: { type: true } } } };
  };
}>;

const SALE_INCLUDE = {
  customer: true,
  seller: { select: { id: true, userName: true, firstName: true, lastName: true } },
  items: {
    where: { isDeleted: false },
    include: {
      extinguisher: { include: { brand: { select: { id: true, name: true } } } },
      product: { select: { id: true, name: true, kind: true } },
      capacity: { include: { type: true } },
    },
  },
  payments: { where: { isDeleted: false }, orderBy: { paidAt: 'asc' } },
  receipts: { where: { isDeleted: false }, orderBy: { issuedAt: 'asc' } },
} satisfies Prisma.SaleInclude;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: BusinessSettingsService,
    private readonly payments: PaymentsService,
    private readonly receipts: ReceiptsService,
  ) {}

  async create(dto: CreateSaleDto, userId: string) {
    // Lecturas previas fuera de la transaccion: con una base remota cada consulta
    // suma latencia y la transaccion interactiva tiene un tiempo maximo.
    const customer = await this.prisma.client.customer.findFirst({
      where: { id: dto.customerId, isDeleted: false },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    const catalog = await this.loadCatalog(dto.items);
    const cfg = await this.settings.get();
    const chargeDate = todayLocal();
    const expirationDate = addMonths(chargeDate, cfg.tagValidityMonths);
    const notifyFrom = addDays(expirationDate, -cfg.renewalNoticeDays);

    const saleId = await this.prisma.client.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          customerId: customer.id,
          sellerId: userId,
          notes: dto.notes,
          createdBy: userId,
        },
      });

      const ctx: ItemContext = { sale, customer, userId, chargeDate, expirationDate, notifyFrom };
      let total = new Prisma.Decimal(0);
      for (const it of dto.items) {
        switch (it.itemType) {
          case SaleItemType.NEW_SALE:
          case SaleItemType.RECHARGE:
            total = total.plus(await this.addExtinguisherItem(tx, ctx, it));
            break;
          case SaleItemType.PRODUCT:
            total = total.plus(await this.addProductItem(tx, ctx, it, catalog.get(it.productId ?? '')));
            break;
          case SaleItemType.KIT:
            total = total.plus(await this.addKitItem(tx, ctx, it, catalog.get(it.productId ?? '')));
            break;
          default:
            total = total.plus(await this.addOtherItem(tx, ctx, it));
        }
      }

      await tx.sale.update({
        where: { id: sale.id },
        data: { totalAmount: total, balanceAmount: total },
      });

      // Factura X por el total de la venta.
      await this.receipts.issue(tx, {
        type: ReceiptType.FACTURA_X,
        saleId: sale.id,
        customerId: customer.id,
        totalAmount: total,
        userId,
      });

      if (dto.initialPayment) {
        await this.payments.registerInTx(tx, sale.id, dto.initialPayment, userId);
      }
      return sale.id;
    }, TX_OPTIONS);
    return this.findOne(saleId);
  }

  /** Productos y kits que usa la venta, validados fuera de la transaccion. */
  private async loadCatalog(items: CreateSaleItemDto[]) {
    const wanted = items.filter((i) => i.itemType === SaleItemType.PRODUCT || i.itemType === SaleItemType.KIT);
    for (const i of wanted) {
      if (!i.productId) throw new BadRequestException('Indicá productId para los ítems PRODUCT y KIT');
    }
    const ids = [...new Set(wanted.map((i) => i.productId!))];
    const rows = ids.length
      ? await this.prisma.client.product.findMany({
          where: { id: { in: ids }, isDeleted: false },
          include: {
            kitItems: {
              orderBy: { createdAt: 'asc' },
              include: {
                product: { select: { id: true, name: true } },
                capacity: { include: { type: true } },
              },
            },
          },
        })
      : [];
    const map = new Map(rows.map((r) => [r.id, r]));
    for (const i of wanted) {
      const p = map.get(i.productId!);
      if (!p) throw new NotFoundException('Producto o kit no encontrado');
      if (!p.isActive) throw new BadRequestException(`"${p.name}" está inactivo`);
      const expected = i.itemType === SaleItemType.KIT ? ProductKind.KIT : ProductKind.PRODUCT;
      if (p.kind !== expected) {
        throw new BadRequestException(`"${p.name}" es ${p.kind === ProductKind.KIT ? 'un kit' : 'un producto'}: usá itemType ${p.kind}`);
      }
    }
    return map;
  }

  /** Matafuego nuevo (NEW_SALE) o recarga (RECHARGE): crea/actualiza el envase, la linea y el aviso. */
  private async addExtinguisherItem(
    tx: Prisma.TransactionClient,
    ctx: ItemContext,
    it: ExtinguisherItemInput,
    opts: { parentItemId?: string; unitPrice?: Prisma.Decimal } = {},
  ) {
    const { customer, userId } = ctx;
    let extinguisher: Prisma.ExtinguisherGetPayload<object> | null = null;
    let capacity: Prisma.ExtinguisherCapacityGetPayload<{ include: { type: true } }> | null = null;

    if (it.extinguisherId) {
      extinguisher = await tx.extinguisher.findFirst({ where: { id: it.extinguisherId, isDeleted: false } });
      if (!extinguisher) throw new NotFoundException('Matafuego no encontrado');
      capacity = await this.findCapacity(tx, extinguisher.capacityId);
    } else if (it.capacityId) {
      capacity = await this.findCapacity(tx, it.capacityId);
    }
    if (!capacity) {
      throw new BadRequestException('Indicá capacityId o extinguisherId para el matafuego');
    }

    const serialNumber = it.serialNumber?.trim() || extinguisher?.serialNumber || undefined;
    if (!serialNumber) {
      throw new BadRequestException('El N° de serie es obligatorio para los matafuegos');
    }
    const licensePlate = normalizeLicensePlate(it.licensePlate) ?? extinguisher?.licensePlate ?? undefined;
    if (!licensePlate && requiresLicensePlate(capacity.type.unit, capacity.capacity)) {
      throw new BadRequestException('La patente es obligatoria para los matafuegos de 1 kg');
    }
    // Un matafuego que todavia no esta registrado necesita marca; los existentes (extinguisherId) no.
    if (!extinguisher && !it.brandId) {
      throw new BadRequestException('La marca es obligatoria para registrar un matafuego');
    }
    if (it.brandId) {
      const brand = await tx.brand.findFirst({ where: { id: it.brandId, isDeleted: false } });
      if (!brand) throw new NotFoundException('Marca no encontrada');
    }
    const status =
      it.itemType === SaleItemType.NEW_SALE ? ExtinguisherStatus.SOLD : ExtinguisherStatus.CUSTOMER_OWNED;
    if (extinguisher) {
      extinguisher = await tx.extinguisher.update({
        where: { id: extinguisher.id },
        data: {
          customerId: customer.id,
          status,
          // Solo completa lo que el envase no tenia cargado.
          ...(!extinguisher.serialNumber ? { serialNumber } : {}),
          ...(!extinguisher.brandId && it.brandId ? { brandId: it.brandId } : {}),
          // La patente se actualiza: queda la ultima informada.
          ...(licensePlate && licensePlate !== extinguisher.licensePlate ? { licensePlate } : {}),
          updatedBy: userId,
        },
      });
    } else {
      extinguisher = await tx.extinguisher.create({
        data: {
          customerId: customer.id,
          capacityId: capacity.id,
          serialNumber,
          manufactureDate: it.manufactureDate ? new Date(it.manufactureDate) : undefined,
          hydraulicTestDueDate: it.hydraulicTestDueDate ? new Date(it.hydraulicTestDueDate) : undefined,
          brandId: it.brandId,
          licensePlate,
          status,
          createdBy: userId,
        },
      });
    }
    const description =
      it.description ??
      `${it.itemType === SaleItemType.NEW_SALE ? 'Venta' : 'Recarga'} ${capacityLabel(
        capacity.type.name,
        capacity.capacity,
        capacity.type.unit,
      )}`;

    const unitPrice =
      opts.unitPrice ??
      (it.unitPrice !== undefined
        ? new Prisma.Decimal(it.unitPrice)
        : it.itemType === SaleItemType.RECHARGE
          ? capacity.rechargePrice
          : capacity.salePrice);
    if (unitPrice === undefined || unitPrice === null) {
      throw new BadRequestException(
        `Falta el precio de "${description}": ingresá unitPrice o cargalo en la lista de precios`,
      );
    }
    const subtotal = new Prisma.Decimal(unitPrice);

    const item = await tx.saleItem.create({
      data: {
        saleId: ctx.sale.id,
        parentItemId: opts.parentItemId,
        extinguisherId: extinguisher.id,
        capacityId: capacity.id,
        itemType: it.itemType,
        description,
        quantity: 1,
        unitPrice,
        subtotal,
        chargeDate: ctx.chargeDate,
        expirationDate: ctx.expirationDate,
        tagOwnerName: customer.displayName,
        tagAddress: customer.address,
        tagLicensePlate: licensePlate,
        createdBy: userId,
      },
    });

    // Una recarga cierra los avisos abiertos de ese mismo envase.
    if (it.itemType === SaleItemType.RECHARGE) {
      await tx.renewalReminder.updateMany({
        where: {
          extinguisherId: extinguisher.id,
          isDeleted: false,
          status: { in: [ReminderStatus.PENDING, ReminderStatus.NOTIFIED, ReminderStatus.CONTACTED] },
        },
        data: { status: ReminderStatus.RENEWED, renewedSaleItemId: item.id, updatedBy: userId },
      });
    }
    await tx.renewalReminder.create({
      data: {
        saleItemId: item.id,
        extinguisherId: extinguisher.id,
        customerId: customer.id,
        dueDate: ctx.expirationDate,
        notifyFrom: ctx.notifyFrom,
        createdBy: userId,
      },
    });
    return subtotal;
  }

  private async addOtherItem(tx: Prisma.TransactionClient, ctx: ItemContext, it: CreateSaleItemDto) {
    if (!it.description) throw new BadRequestException('Los items de tipo OTHER requieren description');
    if (it.unitPrice === undefined) {
      throw new BadRequestException(`Falta el precio de "${it.description}": ingresá unitPrice`);
    }
    const quantity = it.quantity ?? 1;
    const subtotal = new Prisma.Decimal(it.unitPrice).mul(quantity);
    await tx.saleItem.create({
      data: {
        saleId: ctx.sale.id,
        itemType: SaleItemType.OTHER,
        description: it.description,
        quantity,
        unitPrice: it.unitPrice,
        subtotal,
        createdBy: ctx.userId,
      },
    });
    return subtotal;
  }

  /** Producto suelto: descuenta stock (si no alcanza, 400). */
  private async addProductItem(
    tx: Prisma.TransactionClient,
    ctx: ItemContext,
    it: CreateSaleItemDto,
    product: CatalogProduct | undefined,
  ) {
    if (!product) throw new NotFoundException('Producto no encontrado');
    const quantity = it.quantity ?? 1;
    const unitPrice = new Prisma.Decimal(it.unitPrice ?? product.price);
    const subtotal = unitPrice.mul(quantity);
    const item = await tx.saleItem.create({
      data: {
        saleId: ctx.sale.id,
        productId: product.id,
        itemType: SaleItemType.PRODUCT,
        description: product.name,
        quantity,
        unitPrice,
        subtotal,
        createdBy: ctx.userId,
      },
    });
    await takeStock(tx, product, quantity, ctx.userId, item.id);
    return subtotal;
  }

  /**
   * Kit: una linea KIT con el precio fijo del kit y una linea hija por componente (precio 0).
   * Los matafuegos del kit requieren `extinguishers[]` con el N° de serie de cada unidad.
   */
  private async addKitItem(
    tx: Prisma.TransactionClient,
    ctx: ItemContext,
    it: CreateSaleItemDto,
    kit: CatalogProduct | undefined,
  ) {
    if (!kit) throw new NotFoundException('Kit no encontrado');
    const kitQty = it.quantity ?? 1;

    // Matafuegos requeridos por capacidad vs. los que informa el vendedor.
    const needed = new Map<string, number>();
    for (const k of kit.kitItems) {
      if (k.capacityId) needed.set(k.capacityId, (needed.get(k.capacityId) ?? 0) + k.quantity * kitQty);
    }
    const given = new Map<string, KitExtinguisherDto[]>();
    for (const e of it.extinguishers ?? []) {
      given.set(e.capacityId, [...(given.get(e.capacityId) ?? []), e]);
    }
    for (const capacityId of new Set([...needed.keys(), ...given.keys()])) {
      const want = needed.get(capacityId) ?? 0;
      const have = given.get(capacityId)?.length ?? 0;
      if (want !== have) {
        const comp = kit.kitItems.find((k) => k.capacityId === capacityId);
        const label = comp?.capacity
          ? capacityLabel(comp.capacity.type.name, comp.capacity.capacity, comp.capacity.type.unit)
          : 'matafuego';
        throw new BadRequestException(
          `El kit "${kit.name}" incluye ${want} ${label}: cargá el N° de serie de cada uno (recibidos: ${have})`,
        );
      }
    }

    const unitPrice = new Prisma.Decimal(it.unitPrice ?? kit.price);
    const subtotal = unitPrice.mul(kitQty);
    const parent = await tx.saleItem.create({
      data: {
        saleId: ctx.sale.id,
        productId: kit.id,
        itemType: SaleItemType.KIT,
        description: kit.name,
        quantity: kitQty,
        unitPrice,
        subtotal,
        createdBy: ctx.userId,
      },
    });

    const zero = new Prisma.Decimal(0);
    for (const k of kit.kitItems) {
      if (k.product) {
        const quantity = k.quantity * kitQty;
        const child = await tx.saleItem.create({
          data: {
            saleId: ctx.sale.id,
            parentItemId: parent.id,
            productId: k.product.id,
            itemType: SaleItemType.PRODUCT,
            description: k.product.name,
            quantity,
            unitPrice: zero,
            subtotal: zero,
            createdBy: ctx.userId,
          },
        });
        await takeStock(tx, k.product, quantity, ctx.userId, child.id);
      }
    }
    for (const list of given.values()) {
      for (const e of list) {
        await this.addExtinguisherItem(
          tx,
          ctx,
          { ...e, itemType: SaleItemType.NEW_SALE },
          { parentItemId: parent.id, unitPrice: zero },
        );
      }
    }
    return subtotal;
  }

  private findCapacity(tx: Prisma.TransactionClient, id: string) {
    return tx.extinguisherCapacity
      .findFirst({ where: { id, isDeleted: false }, include: { type: true } })
      .then((c) => {
        if (!c) throw new NotFoundException('Capacidad no encontrada');
        return c;
      });
  }

  async list(q: SaleQueryDto) {
    const where: Prisma.SaleWhereInput = {
      isDeleted: false,
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.paymentStatus ? { paymentStatus: q.paymentStatus } : {}),
    };
    const words = q.search?.trim().split(/\s+/).filter(Boolean) ?? [];
    if (words.length) {
      where.AND = words.map((w) => ({
        customer: {
          OR: [
            { displayName: { contains: w, mode: 'insensitive' } },
            { phone: { contains: w } },
            ...(w.replace(/\D/g, '') ? [{ cuit: { contains: w.replace(/\D/g, '') } }] : []),
          ],
        },
      }));
    }
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.sale.findMany({
        where,
        include: {
          customer: { select: CUSTOMER_NAME_SELECT },
        },
        orderBy: { saleDate: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.client.sale.count({ where }),
    ]);
    return paginated(data, total, q);
  }

  async findOne(id: string) {
    const sale = await this.prisma.client.sale.findFirst({
      where: { id, isDeleted: false },
      include: SALE_INCLUDE,
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return sale;
  }

  async cancel(id: string, userId: string, userName: string) {
    const sale = await this.findOne(id);
    if (sale.status === SaleStatus.CANCELLED) {
      throw new BadRequestException('La venta ya está anulada');
    }
    const note = `Venta N° ${sale.saleNumber} anulada por ${userName}`;
    await this.prisma.client.$transaction(async (tx) => {
      await tx.sale.update({ where: { id }, data: { status: SaleStatus.CANCELLED, updatedBy: userId } });
      await tx.receipt.updateMany({ where: { saleId: id }, data: { status: 'VOID', updatedBy: userId } });
      await tx.renewalReminder.updateMany({
        where: {
          saleItem: { saleId: id },
          status: { in: [ReminderStatus.PENDING, ReminderStatus.NOTIFIED] },
        },
        data: { status: ReminderStatus.DISMISSED, notes: note, updatedBy: userId },
      });
      // Repone el stock de los productos vendidos (sueltos y componentes de kits).
      const lines = await tx.saleItem.findMany({
        where: { saleId: id, isDeleted: false, itemType: SaleItemType.PRODUCT, productId: { not: null } },
        select: { id: true, productId: true, quantity: true },
      });
      for (const l of lines) {
        await returnStock(tx, l.productId!, l.quantity, userId, l.id, note);
      }
    }, TX_OPTIONS);
    return this.findOne(id);
  }
}
