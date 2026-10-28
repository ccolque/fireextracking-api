import { PaymentStatus, SaleItemType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
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

/** Un matafuego incluido en un kit: se informa uno por unidad. */
export class KitExtinguisherDto {
  @IsUUID()
  capacityId: string;

  @IsString() @IsNotEmpty() @MaxLength(60)
  serialNumber: string;

  @IsUUID()
  brandId: string;

  /** Obligatoria si el matafuego es de 1 kg. */
  @IsOptional() @IsString() @MaxLength(12)
  licensePlate?: string;

  @IsOptional() @IsDateString()
  manufactureDate?: string;

  @IsOptional() @IsDateString()
  hydraulicTestDueDate?: string;
}

export class CreateSaleItemDto {
  @IsEnum(SaleItemType)
  itemType: SaleItemType;

  /** Tipo+capacidad. Obligatorio para NEW_SALE/RECHARGE si no se indica extinguisherId. */
  @IsOptional() @IsUUID()
  capacityId?: string;

  /** Envase existente (recargas). Si se omite se crea uno nuevo para el cliente. */
  @IsOptional() @IsUUID()
  extinguisherId?: string;

  /** Obligatorio en matafuegos (NEW_SALE/RECHARGE), salvo que el envase existente ya tenga uno. No aplica a OTHER. */
  @IsOptional() @IsString() @MaxLength(60)
  serialNumber?: string;

  @IsOptional() @IsDateString()
  manufactureDate?: string;

  @IsOptional() @IsDateString()
  hydraulicTestDueDate?: string;

  /** Obligatoria al registrar un matafuego nuevo (con capacityId). No se exige con extinguisherId. */
  @IsOptional() @IsUUID()
  brandId?: string;

  /** Patente para la ficha. Obligatoria en matafuegos de 1 kg (si el envase ya tiene una, se reutiliza). */
  @IsOptional() @IsString() @MaxLength(12)
  licensePlate?: string;

  /** Producto (itemType PRODUCT) o kit (itemType KIT) del catalogo. */
  @IsOptional() @IsUUID()
  productId?: string;

  /** Solo KIT: un matafuego por cada unidad que incluye el kit (con su N° de serie). */
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => KitExtinguisherDto)
  extinguishers?: KitExtinguisherDto[];

  /** Obligatoria para itemType OTHER; en matafuegos se arma sola. */
  @IsOptional() @IsString() @MaxLength(255)
  description?: string;

  /** Si se omite se usa el precio de venta/recarga de la capacidad. */
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  unitPrice?: number;

  /** OTHER, PRODUCT y KIT (cantidad de kits); los matafuegos siempre son 1 por item (1 ficha c/u). */
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
