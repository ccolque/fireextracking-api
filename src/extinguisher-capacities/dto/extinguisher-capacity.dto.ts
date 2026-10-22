import { OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateExtinguisherCapacityDto {
  @IsUUID()
  typeId: string;

  /** Valor numerico; la unidad (kg/lts) la da el tipo. */
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01)
  capacity: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  salePrice?: number;

  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  rechargePrice?: number;

  @IsOptional() @Type(() => Number) @IsInt()
  order?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateExtinguisherCapacityDto extends PartialType(OmitType(CreateExtinguisherCapacityDto, ['typeId'] as const)) {}
