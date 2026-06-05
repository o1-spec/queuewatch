import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationSetting } from '@queuewatch/shared';
import { ProjectId } from '../auth/project-id.decorator';

@ApiTags('Notification triggers and settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get recent notification dispatch records' })
  async getNotifications(@ProjectId() projectId: string) {
    return this.notificationsService.getNotifications(100, projectId);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Retrieve notification setting rules for the user' })
  async getSettings() {
    return this.notificationsService.getSettings();
  }

  @Post('settings')
  @ApiOperation({ summary: 'Save notification preference settings' })
  async saveSettings(@Body() settings: NotificationSetting) {
    return this.notificationsService.saveSettings(settings);
  }
}
