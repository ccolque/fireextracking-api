import { OmitType } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID()
  saleId: string;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional() @IsDateString()
  paidAt?: string;

  @IsOptional() @IsString() @MaxLength(120)
  reference?: string;

  @IsOptional() @IsString() @MaxLength(255)
  notes?: string;
}

/** Pago registrado junto con la venta (la venta aun no tiene id). */
export class InitialPaymentDto extends OmitType(CreatePaymentDto, ['saleId'] as const) {}
