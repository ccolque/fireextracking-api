import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReceiptType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessSettingsService } from '../business-settings/business-settings.service';
import { CUSTOMER_NAME_SELECT } from '../common/utils/customer';

export interface IssueReceiptInput {
  type: ReceiptType;
  saleId: string;
  customerId: string;
  totalAmount: Prisma.Decimal;
  paymentId?: string;
  paidToDate?: Prisma.Decimal;
  balanceAfter?: Prisma.Decimal;
  userId: string;
}

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: BusinessSettingsService,
  ) {}

  /**
   * Emite un comprobante con numeracion correlativa. Debe llamarse dentro de una
   * transaccion: el incremento del contador es atomico y evita numeros repetidos.
   */
  async issue(tx: Prisma.TransactionClient, input: IssueReceiptInput) {
    const current = await this.settings.get(tx);
    const isFactura = input.type === ReceiptType.FACTURA_X;
    const updated = await tx.businessSettings.update({
      where: { id: current.id },
      data: isFactura
        ? { facturaXNextNumber: { increment: 1 } }
        : { reciboPagoXNextNumber: { increment: 1 } },
    });
    const used = (isFactura ? updated.facturaXNextNumber : updated.reciboPagoXNextNumber) - 1;
    return tx.receipt.create({
      data: {
        type: input.type,
        pointOfSale: updated.pointOfSale,
        number: String(used).padStart(8, '0'),
        saleId: input.saleId,
        customerId: input.customerId,
        paymentId: input.paymentId,
        totalAmount: input.totalAmount,
        paidToDate: input.paidToDate,
        balanceAfter: input.balanceAfter,
        createdBy: input.userId,
      },
    });
  }

  list(saleId?: string) {
    return this.prisma.client.receipt.findMany({
      where: { isDeleted: false, ...(saleId ? { saleId } : {}) },
      orderBy: { issuedAt: 'desc' },
      include: { customer: { select: CUSTOMER_NAME_SELECT } },
    });
  }

  async findOne(id: string) {
    const receipt = await this.prisma.client.receipt.findFirst({
      where: { id, isDeleted: false },
      include: {
        customer: true,
        payment: true,
        sale: { include: { items: { where: { isDeleted: false } } } },
      },
    });
    if (!receipt) throw new NotFoundException('Comprobante no encontrado');
    return receipt;
  }
}
