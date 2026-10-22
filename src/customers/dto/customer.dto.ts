import { PartialType } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCustomerDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  firstName: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  lastName: string;

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
