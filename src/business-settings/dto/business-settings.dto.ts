import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class UpdateBusinessSettingsDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(160)
  businessName?: string;

  @IsOptional() @IsString() @MaxLength(255)
  address?: string;

  @IsOptional() @IsString() @MaxLength(40)
  phone?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MaxLength(500)
  logoUrl?: string;

  /** Punto de venta (1 a 4 digitos). Se guarda con ceros a la izquierda. */
  @IsOptional() @Matches(/^\d{1,4}$/, { message: 'pointOfSale debe tener de 1 a 4 dígitos' })
  pointOfSale?: string;

  /** Proximo numero de Factura X. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  facturaXNextNumber?: number;

  /** Proximo numero de Recibo de pago. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  reciboPagoXNextNumber?: number;

  /** Dias de anticipacion del aviso de vencimiento. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  renewalNoticeDays?: number;

  /** Vigencia de la carga en meses (12 = vence un anio despues). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  tagValidityMonths?: number;
}
