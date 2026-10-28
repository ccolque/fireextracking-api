import { PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateBrandDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  name: string;
}

export class UpdateBrandDto extends PartialType(CreateBrandDto) {}
