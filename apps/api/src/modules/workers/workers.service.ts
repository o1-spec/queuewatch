import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, Job } from 'bullmq';
import { QueueName } from '@queuewatch/shared';
import { SimulationConfigService } from '../queues/simulation-config.service';
import { QueuesService } from '../queues/queues.service';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';
import { MetricsService } from '../metrics/metrics.service';

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
    private metricsService: MetricsService
  ) {
    this.redisConnection = {
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
    };
  }

  onModuleInit() {
    const queueNames = [
      'email_queue',
      'image_processing_queue',
      'webhook_delivery_queue',
      'ai_task_queue',
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
          concurrency: name === 'email_queue' ? 2 : 5, // Strict concurrency on SMTP email queue
        }
      );

      this.registerWorkerListeners(worker, name);
      this.workers.set(name, worker);
    }

    // Start worker health telemetry ticker
    this.healthInterval = setInterval(() => {
      this.broadcastWorkerHealth();
    }, 4000);
  }

  private async processJob(job: Job, queueName: string): Promise<any> {
    const start = Date.now();
    this.logger.log(`Worker thread processing job ${job.id} (${job.name}) on queue ${queueName}`);

    // Emit job.active event via Socket.IO
    this.wsGateway.broadcast('job.active', {
      queueName,
      jobId: job.id,
      jobName: job.name,
      status: 'active',
      timestamp: Date.now(),
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
    if (config.simulateSmtpFailure && queueName === 'email_queue') {
      throw new Error('SMTP Error: 421 - Too many concurrent connections from your IP range. SendGrid delivery throttled.');
    }

    if (config.simulateWebhookOutage && queueName === 'webhook_delivery_queue') {
      throw new Error('Webhook Delivery Outage: Stripe API connection failed with code 503 (Service Unavailable). Connection timed out.');
    }

    if (config.simulateInvalidPayload && queueName === 'image_processing_queue') {
      throw new Error("InvalidPayloadError: Schema validation failed. Missing required parameter 'imageUrl' in job payload.");
    }

    if (config.simulateTimeoutFailure) {
      throw new Error('Worker Timeout Exception: Job exceeded operational timeout window threshold (10000ms).');
    }

    // Random flakiness in traffic mode to keep metrics charts exciting
    if (config.generateTraffic && Math.random() < 0.08 && queueName === 'ai_task_queue') {
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

      // Emit job.completed event
      this.wsGateway.broadcast('job.completed', {
        queueName,
        jobId: job.id,
        jobName: job.name,
        status: 'completed',
        timestamp: Date.now(),
        latency: result.duration,
      });
    });

    worker.on('failed', async (job: Job | undefined, err: Error) => {
      if (!job) return;

      const attemptsMade = job.attemptsMade;
      const maxAttempts = job.opts.attempts || 3;
      const isDeadLetter = attemptsMade >= maxAttempts;

      if (isDeadLetter) {
        this.logger.warn(`Job ${job.id} permanently failed inside queue ${queueName}. Relocating to Dead-Letter Queue.`);

        // 1. Move original job parameters to Dead-Letter Queue (DLQ) support queue
        const dlq = this.queuesService.getQueue('dead_letter_queue');
        if (dlq) {
          await dlq.add(job.name, {
            originalQueue: queueName,
            originalJobName: job.name,
            originalData: job.data,
            failedAt: Date.now(),
            errorMessage: err.message,
            stackTrace: err.stack,
            attemptsMade,
          });
        }

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
    const queueNames = ['email_queue', 'image_processing_queue', 'webhook_delivery_queue', 'ai_task_queue'];
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
        (config.simulateSmtpFailure && name === 'email_queue') ||
        (config.simulateWebhookOutage && name === 'webhook_delivery_queue') ||
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
        concurrency: name === 'email_queue' ? 2 : 5,
        cpuUsage: Math.round(cpuUsage),
        memoryUsage: Math.round(memoryUsage),
        lastActive: Date.now(),
      };
    });

    this.wsGateway.broadcast('worker.health.updated', healthReports);
  }

  async onModuleDestroy() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }
    for (const [name, worker] of this.workers) {
      await worker.close();
      this.logger.log(`Worker processor for queue "${name}" connection closed.`);
    }
  }
}
