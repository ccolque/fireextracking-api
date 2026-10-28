import { PartialType, OmitType } from '@nestjs/swagger';
import { ProductKind } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
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

/** Componente de un kit: un producto (productId) o un matafuego (capacityId), con cantidad. */
export class KitItemDto {
  @IsOptional() @IsUUID()
  productId?: string;

  @IsOptional() @IsUUID()
  capacityId?: string;

  @Type(() => Number) @IsInt() @Min(1)
  quantity: number;
}

export class CreateProductDto {
  /** PRODUCT (default) o KIT. */
  @IsOptional() @IsEnum(ProductKind)
  kind?: ProductKind;

  @IsString() @IsNotEmpty() @MaxLength(120)
  name: string;

  /** Precio de venta. En un KIT es el precio fijo del kit. */
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  price: number;

  /** Obligatorio en PRODUCT. No aplica a KIT (se calcula con sus componentes). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  stock?: number;

  @IsOptional() @IsUUID()
  brandId?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  /** Solo KIT: componentes (al menos uno). */
  @IsOptional() @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => KitItemDto)
  items?: KitItemDto[];
}

/** El tipo y el stock no se editan por PATCH (el stock se ajusta con POST /products/:id/stock). */
export class UpdateProductDto extends PartialType(OmitType(CreateProductDto, ['kind', 'stock'] as const)) {}

export class ProductQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(ProductKind)
  kind?: ProductKind;

  @IsOptional() @IsUUID()
  brandId?: string;

  /** 'true' = solo activos (para el buscador de ventas). */
  @IsOptional() @IsIn(['true', 'false'])
  activeOnly?: string;
}

export class StockAdjustDto {
  /** Positivo suma, negativo resta. */
  @Type(() => Number) @IsInt()
  delta: number;

  @IsOptional() @IsString() @MaxLength(255)
  notes?: string;
}
