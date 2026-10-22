import { ReminderStatus } from '@prisma/client';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ReminderQueryDto extends PaginationQueryDto {
  /** Por defecto NOTIFIED (los que hay que contactar ahora). */
  @IsOptional() @IsEnum(ReminderStatus)
  status?: ReminderStatus;
}

export class ReminderNotesDto {
  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

export class BulkReminderDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ArrayUnique() @IsUUID('all', { each: true })
  ids: string[];

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}
