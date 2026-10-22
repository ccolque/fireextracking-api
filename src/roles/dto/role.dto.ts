import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetRolePermissionsDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  permissionIds: string[];
}
