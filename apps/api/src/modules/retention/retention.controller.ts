import { Controller, Get, Put, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RetentionService } from './retention.service';
import { RetentionTier } from '@queuewatch/shared';

class SetRetentionDto {
  tier: RetentionTier;
}

@ApiTags('Retention')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/retention')
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Get()
  @ApiOperation({ summary: 'Get retention policy and current usage stats for a project' })
  async getRetention(@Param('projectId') projectId: string) {
    return this.retentionService.getUsageStats(projectId);
  }

  @Put()
  @ApiOperation({ summary: 'Update retention tier for a project (7d / 30d / 90d)' })
  async setRetention(
    @Param('projectId') projectId: string,
    @Body() body: SetRetentionDto,
  ) {
    const valid: RetentionTier[] = ['7d', '30d', '90d'];
    if (!valid.includes(body.tier)) {
      return { error: `Invalid tier. Must be one of: ${valid.join(', ')}` };
    }
    return this.retentionService.setPolicy(projectId, body.tier);
  }

  @Post('purge')
  @ApiOperation({ summary: 'Trigger an immediate purge of expired data for a project' })
  async triggerPurge(@Param('projectId') projectId: string) {
    return this.retentionService.runPurge(projectId);
  }
}
