import { Module } from '@nestjs/common';
import { RenewalRemindersController } from './renewal-reminders.controller';
import { RenewalRemindersService } from './renewal-reminders.service';

@Module({
  controllers: [RenewalRemindersController],
  providers: [RenewalRemindersService],
})
export class RenewalRemindersModule {}
