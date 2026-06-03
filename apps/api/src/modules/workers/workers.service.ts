import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QueueName } from '@queuewatch/shared';
import { SimulationConfigService } from '../queues/simulation-config.service';
import { QueuesService } from '../queues/queues.service';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';
import { MetricsService } from '../metrics/metrics.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { DbService } from '../db/db.service';

@Injectable()
export class WorkersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkersService.name);
  private workers = new Map<string, Worker>();
  private healthInterval: NodeJS.Timeout;
  private redisConnection: any;

  constructor(
    private configService: ConfigService,
    private simConfig: SimulationConfigService,
    @Inject(forwardRef(() => QueuesService))
    private queuesService: QueuesService,
    private wsGateway: QueueWebSocketGateway,
    @Inject(forwardRef(() => MetricsService))
    private metricsService: MetricsService,
    private telemetryService: TelemetryService,
    private dbService: DbService
  ) {
    this.redisConnection = {
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
    };
  }

  onModuleInit() {
    const queueNames = [
      'email_notifications',
      'webhook_delivery',
      'image_processing',
      'ai_tasks',
    ];

    for (const name of queueNames) {
      this.logger.log(`Starting background worker processor for queue "${name}"`);
      
      const worker = new Worker(
        name,
        async (job: Job) => {
          return this.processJob(job, name);
        },
        {
          connection: this.redisConnection,
          concurrency: name === 'email_notifications' ? 2 : 5, // Strict concurrency on email notifications queue
        }
      );

      this.registerWorkerListeners(worker, name);
      this.workers.set(name, worker);

      // Record worker online
      this.telemetryService.recordEvent({
        type: 'worker.status',
        queueName: name as QueueName,
        workerId: `worker_${name}_1`,
        status: 'online',
      });
    }

    // Start worker health telemetry ticker
    this.healthInterval = setInterval(() => {
      this.broadcastWorkerHealth();
    }, 4000);
  }

  private async processJob(job: Job, queueName: string): Promise<any> {
    const start = Date.now();
    this.logger.log(`Worker thread processing job ${job.id} (${job.name}) on queue ${queueName}`);

    // Emit job.active event via telemetry
    this.telemetryService.recordEvent({
      type: 'job.active',
      queueName: queueName as QueueName,
      jobId: job.id,
      jobName: job.name,
      status: 'active',
      payload: job.data,
    });

    const config = this.simConfig.getConfig();

    // 1. Worker Slowdown Simulation
    if (config.simulateWorkerSlowdown) {
      const delay = 8000 + Math.random() * 2000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    } else {
      // Normal latency between 300ms and 1500ms
      const delay = 300 + Math.random() * 1200;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // 2. Failure Simulation Logic
    if (config.simulateSmtpFailure && queueName === 'email_notifications') {
      throw new Error('SMTP Error: 421 - Too many concurrent connections from your IP range. SendGrid delivery throttled.');
    }

    if (config.simulateWebhookOutage && queueName === 'webhook_delivery') {
      throw new Error('Webhook Delivery Outage: Stripe API connection failed with code 503 (Service Unavailable). Connection timed out.');
    }

    if (config.simulateInvalidPayload && queueName === 'image_processing') {
      throw new Error("InvalidPayloadError: Schema validation failed. Missing required parameter 'imageUrl' in job payload.");
    }

    if (config.simulateTimeoutFailure) {
      throw new Error('Worker Timeout Exception: Job exceeded operational timeout window threshold (10000ms).');
    }

    // Random flakiness in traffic mode to keep metrics charts exciting
    if (config.generateTraffic && Math.random() < 0.08 && queueName === 'ai_tasks') {
      throw new Error('DatabaseConnectionTimeoutError: SQLite connection pool exceeded lock count (30000ms delay). Query failed.');
    }

    const duration = Date.now() - start;
    this.logger.log(`Job ${job.id} completed successfully in ${duration}ms`);

    return {
      status: 'success',
      duration,
    };
  }

  private registerWorkerListeners(worker: Worker, queueName: string) {
    worker.on('completed', (job: Job, result: any) => {
      // Record latency snapshot in Metrics sliding window
      this.metricsService.recordLatency(queueName, result.duration);

      // Record and broadcast telemetry
      this.telemetryService.recordEvent({
        type: 'job.completed',
        queueName: queueName as QueueName,
        jobId: job.id,
        jobName: job.name,
        status: 'completed',
        duration: result.duration,
      });
    });

    worker.on('failed', async (job: Job | undefined, err: Error) => {
      if (!job) return;

      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts || 3;
      const isDeadLetter = attemptsMade >= maxAttempts;

      if (isDeadLetter) {
        this.logger.warn(`Job ${job.id} permanently failed inside queue ${queueName}. Relocating to Dead-Letter Queue.`);

        // 1. Construct and save DeadLetterJob to DB
        const dlqJob = {
          id: `dlq_${job.id || Math.random().toString(36).substr(2, 9)}`,
          queueName: queueName as QueueName,
          jobId: job.id || '',
          jobName: job.name,
          payload: job.data,
          failedReason: err.message,
          stackTrace: err.stack ? [err.stack] : [],
          attemptsMade,
          maxAttempts,
          timestamp: Date.now(),
          replayStatus: 'pending' as const,
        };
        await this.dbService.saveDeadLetterJob(dlqJob);

        // 2. Broadcast deadlettered event via websockets
        this.wsGateway.broadcast('job.deadlettered', {
          queueName,
          jobId: job.id,
          jobName: job.name,
          errorMessage: err.message,
          timestamp: Date.now(),
        });
      } else {
        // Broadcast standard retry / failed event
        this.wsGateway.broadcast('job.failed', {
          queueName,
          jobId: job.id,
          jobName: job.name,
          errorMessage: err.message,
          attemptsMade,
          maxAttempts,
          timestamp: Date.now(),
        });
      }
    });
  }

  private broadcastWorkerHealth() {
    const queueNames = ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'];
    const config = this.simConfig.getConfig();

    const healthReports = queueNames.map((name) => {
      let status: 'healthy' | 'overloaded' | 'down' = 'healthy';
      let cpuUsage = 5 + Math.random() * 15;
      let memoryUsage = 20 + Math.random() * 25;

      if (config.simulateWorkerSlowdown) {
        status = 'overloaded';
        cpuUsage = 85 + Math.random() * 10;
        memoryUsage = 70 + Math.random() * 15;
      } else if (
        (config.simulateSmtpFailure && name === 'email_notifications') ||
        (config.simulateWebhookOutage && name === 'webhook_delivery') ||
        config.simulateTimeoutFailure
      ) {
        status = 'down';
        cpuUsage = 2 + Math.random() * 3;
        memoryUsage = 15 + Math.random() * 5;
      }

      const report = {
        workerId: `worker_${name}_1`,
        queueName: name as QueueName,
        status,
        concurrency: name === 'email_notifications' ? 2 : 5,
        cpuUsage: Math.round(cpuUsage),
        memoryUsage: Math.round(memoryUsage),
        lastActive: Date.now(),
      };

      // Record status in telemetry
      this.telemetryService.recordEvent({
        type: 'worker.status',
        queueName: name as QueueName,
        workerId: report.workerId,
        status: status === 'down' ? 'offline' : 'online',
        latency: status === 'overloaded' ? 9000 : 800,
      });

      return report;
    });

    this.wsGateway.broadcast('worker.health.updated', healthReports);
  }

  getWorkersList(): any[] {
    const queueNames = ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'];
    const config = this.simConfig.getConfig();

    return queueNames.map((name) => {
      let status: 'healthy' | 'overloaded' | 'down' = 'healthy';
      let cpuUsage = 5 + Math.random() * 15;
      let memoryUsage = 20 + Math.random() * 25;

      if (config.simulateWorkerSlowdown) {
        status = 'overloaded';
        cpuUsage = 85 + Math.random() * 10;
        memoryUsage = 70 + Math.random() * 15;
      } else if (
        (config.simulateSmtpFailure && name === 'email_notifications') ||
        (config.simulateWebhookOutage && name === 'webhook_delivery') ||
        config.simulateTimeoutFailure
      ) {
        status = 'down';
        cpuUsage = 2 + Math.random() * 3;
        memoryUsage = 15 + Math.random() * 5;
      }

      return {
        workerId: `worker_${name}_1`,
        queueName: name,
        status,
        concurrency: name === 'email_notifications' ? 2 : 5,
        cpuUsage: Math.round(cpuUsage),
        memoryUsage: Math.round(memoryUsage),
        lastActive: Date.now(),
      };
    });
  }

  async onModuleDestroy() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }
    for (const [name, worker] of this.workers) {
      // Record worker offline
      try {
        this.telemetryService.recordEvent({
          type: 'worker.status',
          queueName: name as QueueName,
          workerId: `worker_${name}_1`,
          status: 'offline',
        });
      } catch (e) {}
      await worker.close();
      this.logger.log(`Worker processor for queue "${name}" connection closed.`);
    }
  }
}

