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

  @IsOptional() @IsString() @MaxLength(80)
  brand?: string;

  @IsOptional() @IsEnum(ExtinguisherStatus)
  status?: ExtinguisherStatus;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

export class UpdateExtinguisherDto extends PartialType(CreateExtinguisherDto) {}

export class ExtinguisherQueryDto extends PaginationQueryDto {
  @IsOptional() @IsUUID()
  customerId?: string;
}
