import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma, ReceiptType, SaleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiptsService } from '../receipts/receipts.service';
import { CreatePaymentDto, InitialPaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receipts: ReceiptsService,
  ) {}

  /** Registra el pago, actualiza el saldo de la venta y emite el Recibo de pago. */
  async registerInTx(
    tx: Prisma.TransactionClient,
    saleId: string,
    dto: InitialPaymentDto,
    userId: string,
  ) {
    const sale = await tx.sale.findFirst({ where: { id: saleId, isDeleted: false } });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    if (sale.status === SaleStatus.CANCELLED) {
      throw new BadRequestException('La venta está anulada');
    }
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.gt(sale.balanceAmount)) {
      throw new BadRequestException(
        `El monto supera el saldo pendiente (${sale.balanceAmount.toString()})`,
      );
    }
    const payment = await tx.payment.create({
      data: {
        saleId,
        amount,
        method: dto.method,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        reference: dto.reference,
        notes: dto.notes,
        createdBy: userId,
      },
    });
    const paid = sale.paidAmount.plus(amount);
    const balance = sale.totalAmount.minus(paid);
    await tx.sale.update({
      where: { id: saleId },
      data: {
        paidAmount: paid,
        balanceAmount: balance,
        paymentStatus: balance.lte(0) ? PaymentStatus.PAID : PaymentStatus.PARTIAL,
        updatedBy: userId,
      },
    });
    const receipt = await this.receipts.issue(tx, {
      type: ReceiptType.RECIBO_PAGO_X,
      saleId,
      customerId: sale.customerId,
      paymentId: payment.id,
      totalAmount: amount,
      paidToDate: paid,
      balanceAfter: balance,
      userId,
    });
    return { payment, receipt };
  }

  create(dto: CreatePaymentDto, userId: string) {
    const { saleId, ...rest } = dto;
    return this.prisma.client.$transaction((tx) => this.registerInTx(tx, saleId, rest, userId), { maxWait: 10000, timeout: 30000 });
  }

  listBySale(saleId: string) {
    return this.prisma.client.payment.findMany({
      where: { saleId, isDeleted: false },
      orderBy: { paidAt: 'asc' },
      include: { receipt: true },
    });
  }
}
