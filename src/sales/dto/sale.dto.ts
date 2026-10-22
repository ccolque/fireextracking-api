import { PaymentStatus, SaleItemType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { InitialPaymentDto } from '../../payments/dto/payment.dto';

export class CreateSaleItemDto {
  @IsEnum(SaleItemType)
  itemType: SaleItemType;

  /** Tipo+capacidad. Obligatorio para NEW_SALE/RECHARGE si no se indica extinguisherId. */
  @IsOptional() @IsUUID()
  capacityId?: string;

  /** Envase existente (recargas). Si se omite se crea uno nuevo para el cliente. */
  @IsOptional() @IsUUID()
  extinguisherId?: string;

  @IsOptional() @IsString() @MaxLength(60)
  serialNumber?: string;

  @IsOptional() @IsDateString()
  manufactureDate?: string;

  @IsOptional() @IsDateString()
  hydraulicTestDueDate?: string;

  @IsOptional() @IsString() @MaxLength(80)
  brand?: string;

  /** Obligatoria para itemType OTHER; en matafuegos se arma sola. */
  @IsOptional() @IsString() @MaxLength(255)
  description?: string;

  /** Si se omite se usa el precio de venta/recarga de la capacidad. */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  unitPrice?: number;

  /** Solo para itemType OTHER; los matafuegos siempre son 1 por item (1 ficha c/u). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  quantity?: number;
}

export class CreateSaleDto {
  @IsUUID()
  customerId: string;

  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];

  /** Pago opcional al momento de la venta (total o parcial). */
  @IsOptional() @ValidateNested() @Type(() => InitialPaymentDto)
  initialPayment?: InitialPaymentDto;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

export class SaleQueryDto extends PaginationQueryDto {
  @IsOptional() @IsUUID()
  customerId?: string;

  @IsOptional() @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
}
