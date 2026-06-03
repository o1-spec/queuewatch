import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AlertRule } from '@queuewatch/shared';

@ApiTags('Alert Rules & Configuration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alert-rules')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'List all defined alert rules' })
  async getRules() {
    return this.alertsService.getRules();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new alert rule' })
  async createRule(@Body() body: Omit<AlertRule, 'id'>) {
    const rule: AlertRule = {
      ...body,
      id: `rule_${Math.random().toString(36).substr(2, 9)}`,
    };
    return this.alertsService.saveRule(rule);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing alert rule' })
  async updateRule(@Param('id') id: string, @Body() body: Partial<AlertRule>) {
    const existing = await this.alertsService.getRule(id);
    if (!existing) {
      throw new Error(`Rule ${id} not found`);
    }
    const updated = {
      ...existing,
      ...body,
    };
    return this.alertsService.saveRule(updated);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an alert rule' })
  async deleteRule(@Param('id') id: string) {
    await this.alertsService.deleteRule(id);
    return { success: true };
  }

  @Get('notifications')
  @ApiOperation({ summary: 'List chronological alert notifications' })
  async getNotifications() {
    return this.alertsService.getNotifications();
  }
}
