import { BadRequestException } from '@nestjs/common';
import { Prisma, StockMovementReason } from '@prisma/client';

/** Descuenta stock de forma atomica (nunca queda negativo) y deja el movimiento. */
export async function takeStock(
  tx: Prisma.TransactionClient,
  product: { id: string; name: string },
  qty: number,
  userId: string,
  saleItemId: string,
) {
  const res = await tx.product.updateMany({
    where: { id: product.id, stock: { gte: qty } },
    data: { stock: { decrement: qty }, updatedBy: userId },
  });
  if (!res.count) {
    const cur = await tx.product.findUnique({ where: { id: product.id }, select: { stock: true } });
    throw new BadRequestException(
      `Stock insuficiente de "${product.name}" (disponible: ${cur?.stock ?? 0}, pedido: ${qty})`,
    );
  }
  const after = await tx.product.findUniqueOrThrow({ where: { id: product.id }, select: { stock: true } });
  await tx.stockMovement.create({
    data: {
      productId: product.id,
      delta: -qty,
      stockAfter: after.stock ?? 0,
      reason: StockMovementReason.SALE,
      saleItemId,
      createdBy: userId,
    },
  });
}

/** Repone stock (ej. al anular una venta) y deja el movimiento. */
export async function returnStock(
  tx: Prisma.TransactionClient,
  productId: string,
  qty: number,
  userId: string,
  saleItemId: string,
  notes?: string,
) {
  const after = await tx.product.update({
    where: { id: productId },
    data: { stock: { increment: qty }, updatedBy: userId },
    select: { stock: true },
  });
  await tx.stockMovement.create({
    data: {
      productId,
      delta: qty,
      stockAfter: after.stock ?? 0,
      reason: StockMovementReason.SALE_CANCELLED,
      saleItemId,
      notes,
      createdBy: userId,
    },
  });
}
