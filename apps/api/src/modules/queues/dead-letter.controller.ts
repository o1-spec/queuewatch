import { Controller, Get, Post, Param, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { DbService } from '../db/db.service';
import { QueuesService } from './queues.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeadLetterJob } from '@queuewatch/shared';
import { ProjectId } from '../auth/project-id.decorator';

@ApiTags('Dead Letter Queue Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dead-letter')
export class DeadLetterController {
  constructor(
    private readonly dbService: DbService,
    private readonly queuesService: QueuesService
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all dead-lettered jobs' })
  async getDeadLetterJobs(@ProjectId() projectId: string) {
    return this.dbService.getDeadLetterJobs(projectId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get specific dead letter job details' })
  @ApiParam({ name: 'id', description: 'Dead letter job ID' })
  async getDeadLetterJob(@ProjectId() projectId: string, @Param('id') id: string) {
    const job = await this.dbService.getDeadLetterJob(id, projectId);
    if (!job) {
      throw new NotFoundException(`Dead letter job ${id} not found`);
    }
    return job;
  }

  @Post(':id/replay')
  @ApiOperation({ summary: 'Replay dead letter job by enqueuing back to original queue' })
  @ApiParam({ name: 'id', description: 'Dead letter job ID' })
  async replayDeadLetter(@ProjectId() projectId: string, @Param('id') id: string) {
    const job = await this.dbService.getDeadLetterJob(id, projectId);
    if (!job) {
      throw new NotFoundException(`Dead letter job ${id} not found`);
    }

    // Replay
    const newJob = await this.queuesService.addJob(job.queueName, job.jobName, {
      ...job.payload,
      replayedFrom: job.id,
      replayedAt: Date.now(),
    }, projectId);

    // Mark as replayed and save
    job.replayStatus = 'replayed';
    await this.dbService.saveDeadLetterJob(job, projectId);

    return { success: true, newJobId: newJob.id };
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Mark dead letter job as manually resolved' })
  @ApiParam({ name: 'id', description: 'Dead letter job ID' })
  async resolveDeadLetter(@ProjectId() projectId: string, @Param('id') id: string) {
    const job = await this.dbService.getDeadLetterJob(id, projectId);
    if (!job) {
      throw new NotFoundException(`Dead letter job ${id} not found`);
    }

    job.replayStatus = 'resolved';
    await this.dbService.saveDeadLetterJob(job, projectId);

    return { success: true };
  }
}
