import { PartialType } from '@nestjs/swagger';
import { CapacityUnit } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateExtinguisherTypeDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  code: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  name: string;

  @IsEnum(CapacityUnit)
  unit: CapacityUnit;

  @IsOptional() @Type(() => Number) @IsInt()
  order?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateExtinguisherTypeDto extends PartialType(CreateExtinguisherTypeDto) {}
