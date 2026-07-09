import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Job } from 'bullmq';
import { QueueName } from '@queuewatch/shared';
import Redis from 'ioredis';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';
import { SimulationConfigService } from './simulation-config.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { DbService } from '../db/db.service';

@Injectable()
export class QueuesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueuesService.name);
  private redisConnection: Redis;
  private queues = new Map<string, Queue>();

  constructor(
    private configService: ConfigService,
    private wsGateway: QueueWebSocketGateway,
    public simConfig: SimulationConfigService,
    @Inject(forwardRef(() => TelemetryService))
    private telemetryService: TelemetryService,
    private dbService: DbService
  ) {}

  async onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.logger.log('Connecting to Redis broker using REDIS_URL');
      this.redisConnection = new Redis(redisUrl, {
        maxRetriesPerRequest: null, // Required by BullMQ
        retryStrategy: (times) => Math.min(times * 100, 3000),
      });
    } else {
      const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
      const port = this.configService.get<number>('REDIS_PORT') || 6379;
      this.logger.log(`Connecting to Redis broker at redis://${host}:${port}`);
      this.redisConnection = new Redis({
        host,
        port,
        maxRetriesPerRequest: null, // Required by BullMQ
        retryStrategy: (times) => Math.min(times * 100, 3000),
      });
    }

    this.redisConnection.on('connect', () => {
      this.logger.log('Successfully connected to Redis broker.');
      this.initializeQueues();
    });

    this.redisConnection.on('error', (err) => {
      this.logger.error('Redis broker connection error:', err.message);
    });
  }

  private initializeQueues() {
    const queueNames = [
      'email_notifications',
      'webhook_delivery',
      'image_processing',
      'ai_tasks',
      'dead_letter_queue', // Custom support queue holding failed metadata
    ];

    for (const name of queueNames) {
      if (this.queues.has(name)) continue;

      this.logger.log(`Initializing BullMQ queue stream: "${name}"`);
      const queue = new Queue(name, {
        connection: this.redisConnection as any,
        defaultJobOptions: {
          attempts: 3, // Retry 3 times
          backoff: {
            type: 'exponential',
            delay: 2000, // Exponential backoff starting at 2s (2s, 4s)
          },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      });

      this.queues.set(name, queue);
    }
  }

  getQueue(name: string): Queue | undefined {
    if (!this.queues.has(name)) {
      this.logger.log(`Dynamically initializing BullMQ queue object: "${name}"`);
      const queue = new Queue(name, {
        connection: this.redisConnection as any,
        defaultJobOptions: {
          attempts: 3, // Retry 3 times
          backoff: {
            type: 'exponential',
            delay: 2000, // Exponential backoff starting at 2s (2s, 4s)
          },
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 500 },
        },
      });
      this.queues.set(name, queue);
    }
    return this.queues.get(name);
  }

  getAllQueues(): Map<string, Queue> {
    return this.queues;
  }

  getRedisConnection(): Redis {
    return this.redisConnection;
  }

  async getQueuesList(projectId: string): Promise<any[]> {
    const list: any[] = [];
    const activeQueueNames = await this.dbService.getProjectQueues(projectId);

    // Fetch the latest aggregated metrics from Redis
    const rawMetrics = await this.dbService.getRedis().get('queuewatch:global:queue_metrics');
    const parsedMetrics = rawMetrics ? JSON.parse(rawMetrics) : [];

    for (const name of activeQueueNames) {
      const queue = this.getQueue(name);
      if (!queue) continue;

      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      const isPaused = await queue.isPaused();
      const match = parsedMetrics.find((m: any) => m.queueName === name);

      list.push({
        name,
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: isPaused,
        averageLatency: match ? match.averageLatency : 0,
        throughput: match ? match.throughput : 0,
      });
    }
    return list;
  }

  async addJob(queueName: string, jobName: string, data: any, projectId?: string): Promise<any> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const job = await queue.add(jobName, data);
    this.logger.log(`Enqueued job ${job.id} (${jobName}) inside ${queueName}`);

    // Record and broadcast telemetry
    this.telemetryService.recordEvent({
      type: 'job.created',
      queueName: queueName as QueueName,
      jobId: job.id,
      jobName,
      status: 'waiting',
      payload: data,
    }, projectId);

    return {
      id: job.id,
      name: job.name,
      queueName,
      timestamp: job.timestamp,
    };
  }

  async getQueueJobs(queueName: string, limit = 50): Promise<any[]> {
    const queue = this.getQueue(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const jobStatuses: any[] = ['waiting', 'active', 'completed', 'failed', 'delayed'];
    const rawJobs = await queue.getJobs(jobStatuses, 0, limit, false);

    return Promise.all(rawJobs.map(async (job) => this.mapJobDetails(job, queueName)));
  }

  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    if (queue) {
      await queue.pause();
      this.logger.log(`Paused Queue: ${queueName}`);
    }
  }

  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.getQueue(queueName);
    if (queue) {
      await queue.resume();
      this.logger.log(`Resumed Queue: ${queueName}`);
    }
  }

  /**
   * Redis-Native Dead-Letter Replay Protocol
   */
  async replayJob(jobId: string, projectId?: string): Promise<any> {
    this.logger.log(`Request to replay jobId: ${jobId}`);

    const dlq = this.getQueue('dead_letter_queue');
    if (!dlq) {
      throw new Error('Dead-Letter Queue is not initialized');
    }

    // 1. Find the job inside the DLQ
    const dlqJob = await dlq.getJob(jobId);
    if (dlqJob) {
      const { originalQueue, originalJobName, originalData } = dlqJob.data;

      this.logger.log(`Found DLQ metadata: Re-enqueueing job to original queue "${originalQueue}"`);

      // 2. Re-enqueue the original job
      const replayedJob = await this.addJob(originalQueue, originalJobName, {
        ...originalData,
        replayedFrom: jobId,
        replayedAt: Date.now(),
      }, projectId);

      // 3. Remove the DLQ record
      try {
        await dlqJob.remove();
      } catch (err) {
        this.logger.warn(`Could not delete DLQ job ${jobId}: ${err.message}`);
      }

      return {
        success: true,
        oldJobId: jobId,
        newJobId: replayedJob.id,
        queueName: originalQueue,
      };
    }

    // Fallback: If not in DLQ support queue, search standard queues (e.g. standard completed or failed states)
    for (const [queueName, queue] of this.queues) {
      if (queueName === 'dead_letter_queue') continue;

      const job = await queue.getJob(jobId);
      if (job) {
        const replayedJob = await queue.add(job.name, job.data);
        this.logger.log(`Replayed normal jobId ${jobId} -> new jobId ${replayedJob.id} on queue ${queueName}`);

        try {
          await job.remove();
        } catch (e) {
          this.logger.warn(`Could not delete original normal job ${jobId}: ${e.message}`);
        }

        return {
          success: true,
          oldJobId: jobId,
          newJobId: replayedJob.id,
          queueName,
        };
      }
    }

    throw new Error(`Job with ID ${jobId} not found in any queue`);
  }

  private async mapJobDetails(job: Job, queueName: string): Promise<any> {
    const state = await job.getState();
    return {
      id: job.id,
      name: job.name,
      queueName,
      status: state,
      data: job.data,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts || 3,
      failedReason: job.failedReason,
      stackTrace: job.stacktrace,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      latency: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : undefined,
    };
  }

  async onModuleDestroy() {
    this.logger.log('Cleaning up BullMQ connections...');
    for (const [name, queue] of this.queues) {
      await queue.close();
      this.logger.log(`Queue stream "${name}" connection closed.`);
    }
    if (this.redisConnection) {
      await this.redisConnection.quit();
      this.logger.log('Main Redis connection closed.');
    }
  }
}
