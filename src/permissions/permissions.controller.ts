import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../common/decorators/roles.decorator';
import { ROLE_ADMIN } from '../common/constants';

@ApiTags('permissions')
@ApiBearerAuth()
@Roles(ROLE_ADMIN)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list() {
    return this.prisma.client.permission.findMany({
      where: { isDeleted: false },
      orderBy: { order: 'asc' },
    });
  }
}
