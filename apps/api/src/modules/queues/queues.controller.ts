import { Controller, Get, Post, Body, Param, Query, NotFoundException, UseGuards } from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiParam, 
  ApiBody, 
  ApiResponse, 
  ApiQuery,
  ApiBearerAuth
} from '@nestjs/swagger';
import { QueuesService } from './queues.service';
import { SimulationConfigService, SimulationConfig } from './simulation-config.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// DTO Schemas for Swagger Documentation
class CreateJobDto {
  name: string;
  data?: any;
}

class SimulateConfigDto {
  generateTraffic?: boolean;
  simulateSmtpFailure?: boolean;
  simulateWebhookOutage?: boolean;
  simulateWorkerSlowdown?: boolean;
  simulateInvalidPayload?: boolean;
  simulateTimeoutFailure?: boolean;
}

@ApiTags('Queues Telemetry & Controls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('queues')
export class QueuesController {
  constructor(
    private readonly queuesService: QueuesService,
    private readonly simConfigService: SimulationConfigService
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get overview list of all registered BullMQ queues and job state counters' })
  @ApiResponse({ status: 200, description: 'Return metrics overview for email, image, webhook, and AI task queues.' })
  async getQueues() {
    return this.queuesService.getQueuesList();
  }

  @Get(':name/jobs')
  @ApiOperation({ summary: 'List all jobs inside a specific queue (waiting, active, completed, failed, delayed)' })
  @ApiParam({ name: 'name', description: 'The queue channel name', enum: ['email_queue', 'image_processing_queue', 'webhook_delivery_queue', 'ai_task_queue', 'dead_letter_queue'] })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of returned jobs', type: Number })
  @ApiResponse({ status: 200, description: 'Successful lookup.' })
  async getJobs(
    @Param('name') name: string,
    @Query('limit') limit?: number
  ) {
    try {
      const recordsLimit = limit ? Number(limit) : 50;
      return await this.queuesService.getQueueJobs(name, recordsLimit);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Post(':name/jobs')
  @ApiOperation({ summary: 'Enqueue a custom job manually with payload data' })
  @ApiParam({ name: 'name', description: 'The target queue channel name', enum: ['email_queue', 'image_processing_queue', 'webhook_delivery_queue', 'ai_task_queue'] })
  @ApiBody({ type: CreateJobDto, description: 'Specify job action name and payload input parameters' })
  @ApiResponse({ status: 201, description: 'Job enqueued successfully.' })
  async enqueueJob(
    @Param('name') name: string,
    @Body() body: CreateJobDto
  ) {
    try {
      return await this.queuesService.addJob(name, body.name, body.data || {});
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Post(':name/pause')
  @ApiOperation({ summary: 'Temporarily pause a queue to stall background workers' })
  @ApiParam({ name: 'name', description: 'The target queue name' })
  @ApiResponse({ status: 200, description: 'Queue successfully paused.' })
  async pauseQueue(@Param('name') name: string) {
    try {
      await this.queuesService.pauseQueue(name);
      return { success: true, message: `Queue "${name}" has been paused.` };
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Post(':name/resume')
  @ApiOperation({ summary: 'Resume a paused queue to restart background processing' })
  @ApiParam({ name: 'name', description: 'The target queue name' })
  @ApiResponse({ status: 200, description: 'Queue successfully resumed.' })
  async resumeQueue(@Param('name') name: string) {
    try {
      await this.queuesService.resumeQueue(name);
      return { success: true, message: `Queue "${name}" has been resumed.` };
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Post(':name/simulate')
  @ApiOperation({ summary: 'Configure in-memory error simulators and background traffic' })
  @ApiParam({ name: 'name', description: 'Active queue identifier', enum: ['email_queue'] })
  @ApiBody({ type: SimulateConfigDto, description: 'Toggle active simulations' })
  @ApiResponse({ status: 200, description: 'Simulation settings updated successfully.' })
  async toggleSimulation(
    @Param('name') name: string,
    @Body() body: SimulateConfigDto
  ) {
    const updated = this.simConfigService.updateConfig(body as Partial<SimulationConfig>);
    return {
      success: true,
      config: updated,
    };
  }

  @Post('/jobs/:id/replay')
  @ApiOperation({ summary: 'Replay a failed or dead-lettered job by looking up original metadata and re-enqueueing' })
  @ApiParam({ name: 'id', description: 'Original failed jobId' })
  @ApiResponse({ status: 200, description: 'Job enqueued and DLQ record removed successfully.' })
  async replayJob(@Param('id') id: string) {
    try {
      return await this.queuesService.replayJob(id);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }
}
