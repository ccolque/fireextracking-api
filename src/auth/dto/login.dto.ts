import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @IsNotEmpty()
  userName: string;

  @ApiProperty({ example: 'CambiarEsto123!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
