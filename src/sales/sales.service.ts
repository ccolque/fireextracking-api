import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ExtinguisherStatus,
  Prisma,
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
import { CreateSaleDto, SaleQueryDto } from './dto/sale.dto';

// Las ventas con varios items hacen muchas consultas; el default de Prisma (5 s) no alcanza con BD remota.
const TX_OPTIONS = { maxWait: 10000, timeout: 60000 };

const SALE_INCLUDE = {
  customer: true,
  seller: { select: { id: true, userName: true, firstName: true, lastName: true } },
  items: {
    where: { isDeleted: false },
    include: {
      extinguisher: true,
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

      let total = new Prisma.Decimal(0);
      for (const it of dto.items) {
        const isExtinguisher = it.itemType !== SaleItemType.OTHER;
        let extinguisher: Prisma.ExtinguisherGetPayload<object> | null = null;
        let capacity: Prisma.ExtinguisherCapacityGetPayload<{ include: { type: true } }> | null = null;

        if (it.extinguisherId) {
          extinguisher = await tx.extinguisher.findFirst({
            where: { id: it.extinguisherId, isDeleted: false },
          });
          if (!extinguisher) throw new NotFoundException('Matafuego no encontrado');
          capacity = await this.findCapacity(tx, extinguisher.capacityId);
        } else if (it.capacityId) {
          capacity = await this.findCapacity(tx, it.capacityId);
        }

        let description = it.description;
        let quantity = it.quantity ?? 1;

        if (isExtinguisher) {
          if (!capacity) {
            throw new BadRequestException('Indicá capacityId o extinguisherId para el matafuego');
          }
          quantity = 1;
          const status =
            it.itemType === SaleItemType.NEW_SALE
              ? ExtinguisherStatus.SOLD
              : ExtinguisherStatus.CUSTOMER_OWNED;
          if (extinguisher) {
            extinguisher = await tx.extinguisher.update({
              where: { id: extinguisher.id },
              data: { customerId: customer.id, status, updatedBy: userId },
            });
          } else {
            extinguisher = await tx.extinguisher.create({
              data: {
                customerId: customer.id,
                capacityId: capacity.id,
                serialNumber: it.serialNumber,
                manufactureDate: it.manufactureDate ? new Date(it.manufactureDate) : undefined,
                hydraulicTestDueDate: it.hydraulicTestDueDate
                  ? new Date(it.hydraulicTestDueDate)
                  : undefined,
                brand: it.brand,
                status,
                createdBy: userId,
              },
            });
          }
          description ??= `${it.itemType === SaleItemType.NEW_SALE ? 'Venta' : 'Recarga'} ${capacityLabel(
            capacity.type.name,
            capacity.capacity,
            capacity.type.unit,
          )}`;
        } else if (!description) {
          throw new BadRequestException('Los items de tipo OTHER requieren description');
        }

        const unitPrice =
          it.unitPrice !== undefined
            ? new Prisma.Decimal(it.unitPrice)
            : it.itemType === SaleItemType.RECHARGE
              ? capacity?.rechargePrice
              : capacity?.salePrice;
        if (unitPrice === undefined || unitPrice === null) {
          throw new BadRequestException(
            `Falta el precio de "${description}": ingresá unitPrice o cargalo en la lista de precios`,
          );
        }
        const subtotal = new Prisma.Decimal(unitPrice).mul(quantity);
        total = total.plus(subtotal);

        const item = await tx.saleItem.create({
          data: {
            saleId: sale.id,
            extinguisherId: extinguisher?.id,
            capacityId: capacity?.id,
            itemType: it.itemType,
            description,
            quantity,
            unitPrice,
            subtotal,
            chargeDate: isExtinguisher ? chargeDate : undefined,
            expirationDate: isExtinguisher ? expirationDate : undefined,
            tagOwnerName: isExtinguisher ? `${customer.firstName} ${customer.lastName}` : undefined,
            tagAddress: isExtinguisher ? customer.address : undefined,
            createdBy: userId,
          },
        });

        if (isExtinguisher && extinguisher) {
          // Una recarga cierra los avisos abiertos de ese mismo envase.
          if (it.itemType === SaleItemType.RECHARGE) {
            await tx.renewalReminder.updateMany({
              where: {
                extinguisherId: extinguisher.id,
                isDeleted: false,
                status: {
                  in: [ReminderStatus.PENDING, ReminderStatus.NOTIFIED, ReminderStatus.CONTACTED],
                },
              },
              data: {
                status: ReminderStatus.RENEWED,
                renewedSaleItemId: item.id,
                updatedBy: userId,
              },
            });
          }
          await tx.renewalReminder.create({
            data: {
              saleItemId: item.id,
              extinguisherId: extinguisher.id,
              customerId: customer.id,
              dueDate: expirationDate,
              notifyFrom,
              createdBy: userId,
            },
          });
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
            { firstName: { contains: w, mode: 'insensitive' } },
            { lastName: { contains: w, mode: 'insensitive' } },
            { phone: { contains: w } },
          ],
        },
      }));
    }
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.sale.findMany({
        where,
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
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
    await this.prisma.client.$transaction([
      this.prisma.client.sale.update({
        where: { id },
        data: { status: SaleStatus.CANCELLED, updatedBy: userId },
      }),
      this.prisma.client.receipt.updateMany({
        where: { saleId: id },
        data: { status: 'VOID', updatedBy: userId },
      }),
      this.prisma.client.renewalReminder.updateMany({
        where: {
          saleItem: { saleId: id },
          status: { in: [ReminderStatus.PENDING, ReminderStatus.NOTIFIED] },
        },
        data: {
          status: ReminderStatus.DISMISSED,
          notes: `Venta N° ${sale.saleNumber} anulada por ${userName}`,
          updatedBy: userId,
        },
      }),
    ]);
    return this.findOne(id);
  }
}
