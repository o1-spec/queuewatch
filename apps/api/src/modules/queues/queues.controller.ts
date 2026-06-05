import { Controller, Get, Post, Body, Param, Query, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { QueuesService } from './queues.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectId } from '../auth/project-id.decorator';

class CreateJobDto {
  name: string;
  data?: any;
}

@ApiTags('Queues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('queues')
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Get()
  @ApiOperation({ summary: 'Get overview of all queues' })
  async getQueues() {
    return this.queuesService.getQueuesList();
  }

  @Get(':name/metrics')
  @ApiOperation({ summary: 'Get metrics for a specific queue' })
  @ApiParam({ name: 'name', enum: ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'] })
  async getQueueMetrics(@Param('name') name: string) {
    const queue = this.queuesService.getQueue(name);
    if (!queue) {
      throw new NotFoundException(`Queue ${name} not found`);
    }
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      queueName: name,
      waitingCount: waiting,
      activeCount: active,
      completedCount: completed,
      failedCount: failed,
      delayedCount: delayed,
      paused: await queue.isPaused(),
      timestamp: Date.now(),
    };
  }

  @Get(':name/jobs')
  @ApiOperation({ summary: 'List jobs in a queue' })
  @ApiParam({ name: 'name', enum: ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks', 'dead_letter_queue'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getJobs(@Param('name') name: string, @Query('limit') limit?: number) {
    try {
      const recordsLimit = limit ? Number(limit) : 50;
      return await this.queuesService.getQueueJobs(name, recordsLimit);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Post(':name/jobs')
  @ApiOperation({ summary: 'Enqueue a job manually' })
  @ApiParam({ name: 'name', enum: ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'] })
  async enqueueJob(@ProjectId() projectId: string, @Param('name') name: string, @Body() body: CreateJobDto) {
    try {
      return await this.queuesService.addJob(name, body.name, body.data || {}, projectId);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Post(':name/pause')
  @ApiOperation({ summary: 'Pause a queue' })
  async pauseQueue(@Param('name') name: string) {
    try {
      await this.queuesService.pauseQueue(name);
      return { success: true, message: `Queue "${name}" paused.` };
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Post(':name/resume')
  @ApiOperation({ summary: 'Resume a queue' })
  async resumeQueue(@Param('name') name: string) {
    try {
      await this.queuesService.resumeQueue(name);
      return { success: true, message: `Queue "${name}" resumed.` };
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }

  @Post('jobs/:id/replay')
  @ApiOperation({ summary: 'Replay a failed/DLQ job' })
  async replayJob(@ProjectId() projectId: string, @Param('id') id: string) {
    try {
      return await this.queuesService.replayJob(id, projectId);
    } catch (e) {
      throw new NotFoundException(e.message);
    }
  }
}
