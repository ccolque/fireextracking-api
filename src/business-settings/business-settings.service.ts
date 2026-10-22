import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateBusinessSettingsDto } from './dto/business-settings.dto';

@Injectable()
export class BusinessSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Devuelve la unica fila de configuracion; la crea con valores por defecto si no existe. */
  async get(tx: Prisma.TransactionClient = this.prisma.client) {
    const existing = await tx.businessSettings.findFirst({
      where: { isDeleted: false },
    });
    if (existing) return existing;
    return tx.businessSettings.create({ data: { businessName: 'Matafuegos' } });
  }

  async update(dto: UpdateBusinessSettingsDto, actorId: string) {
    return this.prisma.client.$transaction(async (tx) => {
      const current = await this.get(tx);
      const data: Prisma.BusinessSettingsUpdateInput = { ...dto, updatedBy: actorId };
      if (dto.pointOfSale) data.pointOfSale = dto.pointOfSale.padStart(4, '0');
      const updated = await tx.businessSettings.update({
        where: { id: current.id },
        data,
      });
      if (
        dto.renewalNoticeDays !== undefined &&
        dto.renewalNoticeDays !== current.renewalNoticeDays
      ) {
        // Recalcula la fecha de aviso de los vencimientos que aun no se notificaron.
        await tx.$executeRaw`
          UPDATE renewal_reminders
          SET notify_from = due_date - ${dto.renewalNoticeDays}::int
          WHERE status = 'PENDING' AND is_deleted = false`;
      }
      return updated;
    });
  }
}
