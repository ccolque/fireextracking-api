import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { BusinessSettingsModule } from './business-settings/business-settings.module';
import { ExtinguisherTypesModule } from './extinguisher-types/extinguisher-types.module';
import { ExtinguisherCapacitiesModule } from './extinguisher-capacities/extinguisher-capacities.module';
import { CustomersModule } from './customers/customers.module';
import { ExtinguishersModule } from './extinguishers/extinguishers.module';
import { ReceiptsModule } from './receipts/receipts.module';
import { PaymentsModule } from './payments/payments.module';
import { SalesModule } from './sales/sales.module';
import { RenewalRemindersModule } from './renewal-reminders/renewal-reminders.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    BusinessSettingsModule,
    ExtinguisherTypesModule,
    ExtinguisherCapacitiesModule,
    CustomersModule,
    ExtinguishersModule,
    ReceiptsModule,
    PaymentsModule,
    SalesModule,
    RenewalRemindersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
