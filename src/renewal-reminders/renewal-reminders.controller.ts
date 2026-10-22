import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RenewalRemindersService } from './renewal-reminders.service';
import { BulkReminderDto, ReminderNotesDto, ReminderQueryDto } from './dto/renewal-reminder.dto';

@ApiTags('renewal-reminders')
@ApiBearerAuth()
@Controller('renewal-reminders')
export class RenewalRemindersController {
  constructor(private readonly reminders: RenewalRemindersService) {}

  /** Avisos de vencimiento. Por defecto los NOTIFIED (clientes a contactar). */
  @Get()
  list(@Query() q: ReminderQueryDto) {
    return this.reminders.list(q);
  }

  /** Igual que GET /renewal-reminders pero una fila por cliente + fecha de vencimiento. */
  @Get('grouped')
  listGrouped(@Query() q: ReminderQueryDto) {
    return this.reminders.listGrouped(q);
  }

  /** Contadores por estado en grupos (cliente + fecha), no en matafuegos. */
  @Get('summary/grouped')
  summaryGrouped() {
    return this.reminders.summaryGrouped();
  }

  @Get('summary')
  summary() {
    return this.reminders.summary();
  }

  /** Fuerza el chequeo (el mismo que corre el job diario). */
  @Post('check')
  async check() {
    return { notified: await this.reminders.notifyDue() };
  }

  /** Contactado para varios avisos a la vez (ej. todos los de un grupo). */
  @Patch('bulk-contacted')
  bulkContacted(@Body() dto: BulkReminderDto, @CurrentUser('userId') userId: string) {
    return this.reminders.bulkContacted(dto.ids, dto.notes, userId);
  }

  @Patch('bulk-dismiss')
  bulkDismiss(@Body() dto: BulkReminderDto, @CurrentUser('userId') userId: string) {
    return this.reminders.bulkDismiss(dto.ids, dto.notes, userId);
  }

  @Patch(':id/contacted')
  contacted(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReminderNotesDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.reminders.markContacted(id, dto.notes, userId);
  }

  @Patch(':id/dismiss')
  dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReminderNotesDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.reminders.dismiss(id, dto.notes, userId);
  }
}
