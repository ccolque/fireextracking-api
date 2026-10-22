import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, ReminderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginated } from '../common/dto/pagination-query.dto';
import { todayLocal } from '../common/utils/dates';
import { capacityLabel } from '../common/utils/labels';
import { ReminderQueryDto } from './dto/renewal-reminder.dto';

const INCLUDE = {
  customer: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
  extinguisher: { include: { capacity: { include: { type: true } } } },
  saleItem: { select: { id: true, saleId: true, description: true, chargeDate: true } },
} satisfies Prisma.RenewalReminderInclude;

@Injectable()
export class RenewalRemindersService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RenewalRemindersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      await this.notifyDue();
    } catch (e) {
      this.logger.warn(`No se pudo ejecutar el chequeo inicial de vencimientos: ${e}`);
    }
  }

  /** Marca como NOTIFIED los avisos cuya fecha de aviso ya llego. */
  @Cron('0 6 * * *', { timeZone: 'America/Argentina/Salta' })
  async notifyDue() {
    const res = await this.prisma.client.renewalReminder.updateMany({
      where: {
        isDeleted: false,
        status: ReminderStatus.PENDING,
        notifyFrom: { lte: todayLocal() },
      },
      data: { status: ReminderStatus.NOTIFIED, notifiedAt: new Date() },
    });
    if (res.count) this.logger.log(`${res.count} aviso(s) de vencimiento notificados`);
    return res.count;
  }

  async list(q: ReminderQueryDto) {
    const where: Prisma.RenewalReminderWhereInput = {
      isDeleted: false,
      status: q.status ?? ReminderStatus.NOTIFIED,
    };
    const [data, total] = await this.prisma.client.$transaction([
      this.prisma.client.renewalReminder.findMany({
        where,
        include: INCLUDE,
        orderBy: { dueDate: 'asc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.client.renewalReminder.count({ where }),
    ]);
    return paginated(data, total, q);
  }

  /**
   * Avisos agrupados por cliente + fecha de vencimiento (una fila por contacto).
   * La paginacion es sobre grupos, asi un grupo nunca se parte en dos paginas.
   */
  async listGrouped(q: ReminderQueryDto) {
    const status = q.status ?? ReminderStatus.NOTIFIED;
    const where: Prisma.RenewalReminderWhereInput = { isDeleted: false, status };

    const keys = await this.prisma.client.renewalReminder.groupBy({
      by: ['customerId', 'dueDate'],
      where,
      orderBy: [{ dueDate: 'asc' }, { customerId: 'asc' }],
    });
    const pageKeys = keys.slice((q.page - 1) * q.limit, q.page * q.limit);
    if (!pageKeys.length) return paginated([], keys.length, q);

    const rows = await this.prisma.client.renewalReminder.findMany({
      where: {
        ...where,
        OR: pageKeys.map((k) => ({ customerId: k.customerId, dueDate: k.dueDate })),
      },
      include: INCLUDE,
      orderBy: [{ createdAt: 'asc' }],
    });

    const data = pageKeys.map((k) => {
      const items = rows.filter(
        (r) => r.customerId === k.customerId && r.dueDate.getTime() === k.dueDate.getTime(),
      );
      return {
        customerId: k.customerId,
        dueDate: k.dueDate,
        status,
        customer: items[0].customer,
        count: items.length,
        reminderIds: items.map((r) => r.id),
        reminders: items.map((r) => ({
          id: r.id,
          status: r.status,
          notes: r.notes,
          notifyFrom: r.notifyFrom,
          extinguisher: {
            id: r.extinguisher.id,
            serialNumber: r.extinguisher.serialNumber,
            label: capacityLabel(
              r.extinguisher.capacity.type.name,
              r.extinguisher.capacity.capacity,
              r.extinguisher.capacity.type.unit,
            ),
          },
          saleItem: r.saleItem,
        })),
      };
    });
    return paginated(data, keys.length, q);
  }

  /** Cantidad de grupos (cliente + fecha) por estado: lo que realmente hay que contactar. */
  async summaryGrouped() {
    const rows = await this.prisma.client.renewalReminder.groupBy({
      by: ['status', 'customerId', 'dueDate'],
      where: { isDeleted: false },
    });
    const out: Record<string, number> = {};
    for (const s of Object.values(ReminderStatus)) out[s] = 0;
    for (const r of rows) out[r.status] += 1;
    return out;
  }

  /** Marca varios avisos (un grupo) como contactados en una sola operacion. */
  async bulkContacted(ids: string[], notes: string | undefined, userId: string) {
    const res = await this.prisma.client.renewalReminder.updateMany({
      where: { id: { in: ids }, isDeleted: false, status: { not: ReminderStatus.RENEWED } },
      data: {
        status: ReminderStatus.CONTACTED,
        contactedAt: new Date(),
        contactedBy: userId,
        notes,
        updatedBy: userId,
      },
    });
    return { updated: res.count };
  }

  async bulkDismiss(ids: string[], notes: string | undefined, userId: string) {
    const res = await this.prisma.client.renewalReminder.updateMany({
      where: { id: { in: ids }, isDeleted: false, status: { not: ReminderStatus.RENEWED } },
      data: { status: ReminderStatus.DISMISSED, notes, updatedBy: userId },
    });
    return { updated: res.count };
  }

  /** Cantidad por estado, para la campana/badge del sistema. */
  async summary() {
    const rows = await this.prisma.client.renewalReminder.groupBy({
      by: ['status'],
      where: { isDeleted: false },
      _count: { _all: true },
    });
    const out: Record<string, number> = {};
    for (const s of Object.values(ReminderStatus)) out[s] = 0;
    for (const r of rows) out[r.status] = r._count._all;
    return out;
  }

  private async findOpen(id: string) {
    const r = await this.prisma.client.renewalReminder.findFirst({ where: { id, isDeleted: false } });
    if (!r) throw new NotFoundException('Aviso no encontrado');
    if (r.status === ReminderStatus.RENEWED) {
      throw new BadRequestException('El aviso ya fue renovado');
    }
    return r;
  }

  async markContacted(id: string, notes: string | undefined, userId: string) {
    await this.findOpen(id);
    return this.prisma.client.renewalReminder.update({
      where: { id },
      data: {
        status: ReminderStatus.CONTACTED,
        contactedAt: new Date(),
        contactedBy: userId,
        notes,
        updatedBy: userId,
      },
      include: INCLUDE,
    });
  }

  async dismiss(id: string, notes: string | undefined, userId: string) {
    await this.findOpen(id);
    return this.prisma.client.renewalReminder.update({
      where: { id },
      data: { status: ReminderStatus.DISMISSED, notes, updatedBy: userId },
      include: INCLUDE,
    });
  }
}
