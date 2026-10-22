import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLE_ADMIN } from '../common/constants';
import { SetRolePermissionsDto } from './dto/role.dto';

@ApiTags('roles')
@ApiBearerAuth()
@Roles(ROLE_ADMIN)
@Controller('roles')
export class RolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.client.role.findMany({
      where: { isDeleted: false },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true },
    });
  }

  @Get(':id/permissions')
  async permissions(@Param('id', ParseUUIDPipe) id: string) {
    const rows = await this.prisma.client.rolePermission.findMany({
      where: { roleId: id, isDeleted: false, permission: { isDeleted: false } },
      include: { permission: true },
      orderBy: { permission: { order: 'asc' } },
    });
    return rows.map((r) => r.permission);
  }

  /** Reemplaza el conjunto de permisos del rol. */
  @Put(':id/permissions')
  async setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetRolePermissionsDto,
    @CurrentUser('userId') userId: string,
  ) {
    await this.prisma.client.$transaction([
      this.prisma.client.rolePermission.deleteMany({ where: { roleId: id } }),
      this.prisma.client.rolePermission.createMany({
        data: dto.permissionIds.map((permissionId) => ({
          roleId: id,
          permissionId,
          createdBy: userId,
        })),
      }),
    ]);
    return { success: true };
  }
}
