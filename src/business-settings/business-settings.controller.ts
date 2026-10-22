import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ROLE_ADMIN } from '../common/constants';
import { BusinessSettingsService } from './business-settings.service';
import { UpdateBusinessSettingsDto } from './dto/business-settings.dto';

@ApiTags('business-settings')
@ApiBearerAuth()
@Controller('business-settings')
export class BusinessSettingsController {
  constructor(private readonly settings: BusinessSettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @Roles(ROLE_ADMIN)
  @Patch()
  update(@Body() dto: UpdateBusinessSettingsDto, @CurrentUser('userId') actorId: string) {
    return this.settings.update(dto, actorId);
  }
}
