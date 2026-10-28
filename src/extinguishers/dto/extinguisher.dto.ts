import { OmitType, PartialType } from '@nestjs/swagger';
import { ExtinguisherStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class CreateExtinguisherDto {
  @IsOptional() @IsUUID()
  customerId?: string;

  @IsUUID()
  capacityId: string;

  @IsOptional() @IsString() @MaxLength(60)
  serialNumber?: string;

  @IsOptional() @IsDateString()
  manufactureDate?: string;

  @IsOptional() @IsDateString()
  hydraulicTestDueDate?: string;

  /** Obligatoria al crear (en PATCH sigue siendo opcional: hay envases viejos sin marca). */
  @IsUUID()
  brandId: string;

  /** Patente (matafuegos de 1 kg). */
  @IsOptional() @IsString() @MaxLength(12)
  licensePlate?: string;

  @IsOptional() @IsEnum(ExtinguisherStatus)
  status?: ExtinguisherStatus;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

export class UpdateExtinguisherDto extends PartialType(CreateExtinguisherDto) {}

export class ExtinguisherQueryDto extends PaginationQueryDto {
  /** Filtra por dueño (para recargas: los matafuegos que ya tiene el cliente). */
  @IsOptional() @IsUUID()
  customerId?: string;
}
