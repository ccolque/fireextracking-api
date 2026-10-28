import { PartialType } from '@nestjs/swagger';
import { CustomerType } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * PERSON  (persona humana): firstName y lastName obligatorios.
 * COMPANY (persona juridica): businessName (razon social) y cuit obligatorios;
 *         firstName/lastName no aplican (si se envian, se ignoran).
 * Las reglas por tipo se validan en el service (aplican tambien al PATCH).
 */
export class CreateCustomerDto {
  /** Por defecto PERSON. */
  @IsOptional() @IsEnum(CustomerType)
  customerType?: CustomerType;

  @IsOptional() @IsString() @MaxLength(120)
  firstName?: string;

  @IsOptional() @IsString() @MaxLength(120)
  lastName?: string;

  /** Razon social (solo COMPANY). */
  @IsOptional() @IsString() @MaxLength(200)
  businessName?: string;

  /** 11 digitos; se aceptan guiones ("30-12345678-1"). */
  @IsOptional() @IsString() @MaxLength(13)
  cuit?: string;

  @IsString() @IsNotEmpty() @MaxLength(30)
  phone: string;

  @IsOptional() @IsString() @MaxLength(255)
  address?: string;

  @IsOptional() @IsEmail() @MaxLength(255)
  email?: string;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class CustomerQueryDto extends PaginationQueryDto {
  /** Filtra por tipo de cliente. */
  @IsOptional() @IsEnum(CustomerType)
  customerType?: CustomerType;
}
