import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DbService } from '../db/db.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeploymentEvent } from '@queuewatch/shared';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';

@ApiTags('Deployments & releases')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('deployments')
export class DeploymentsController {
  constructor(
    private readonly dbService: DbService,
    private readonly wsGateway: QueueWebSocketGateway
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all deployment events' })
  async getDeployments() {
    return this.dbService.getDeploymentEvents();
  }

  @Get('recent')
  @ApiOperation({ summary: 'List deployment events within the last 30 minutes' })
  async getRecentDeployments() {
    const all = await this.dbService.getDeploymentEvents();
    const thirtyMinAgo = Date.now() - 30 * 60 * 1000;
    return all.filter((d) => d.deployedAt >= thirtyMinAgo);
  }

  @Post()
  @ApiOperation({ summary: 'Register a new deployment release' })
  async createDeployment(@Body() data: Omit<DeploymentEvent, 'id' | 'deployedAt'>) {
    const event: DeploymentEvent = {
      ...data,
      id: `dep_${Math.random().toString(36).substr(2, 9)}`,
      deployedAt: Date.now(),
    };

    await this.dbService.saveDeploymentEvent(event);
    this.wsGateway.broadcast('deployment.created', event);
    return event;
  }
}
