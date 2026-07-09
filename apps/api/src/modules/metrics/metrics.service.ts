import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import { QueuesService } from '../queues/queues.service';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';
import { IncidentsService } from '../incidents/incidents.service';
import { AlertsService } from '../alerts/alerts.service';
import { QueueName } from '@queuewatch/shared';

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private timer: NodeJS.Timeout;

  // Sliding window latency registers
  private latencyWindow = new Map<string, number[]>();
  private completedTick = new Map<string, number>();

  constructor(
    @Inject(forwardRef(() => QueuesService))
    private queuesService: QueuesService,
    private wsGateway: QueueWebSocketGateway,
    @Inject(forwardRef(() => IncidentsService))
    private incidentsService: IncidentsService,
    private alertsService: AlertsService
  ) {
    const queueNames = ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'];
    for (const name of queueNames) {
      this.latencyWindow.set(name, [750, 900, 1100]); // Seed starting samples
      this.completedTick.set(name, 0);
    }
  }

  onModuleInit() {
    this.timer = setInterval(() => {
      this.collectMetrics();
    }, 2000);
    this.logger.log('Metrics aggregation engine running. Compiling telemetry...');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  recordLatency(queueName: string, duration: number) {
    const buffer = this.latencyWindow.get(queueName) || [];
    buffer.push(duration);
    if (buffer.length > 30) {
      buffer.shift(); // Keep last 30 samples
    }
    this.latencyWindow.set(queueName, buffer);

    const count = this.completedTick.get(queueName) || 0;
    this.completedTick.set(queueName, count + 1);
  }

  private async collectMetrics() {
    try {
      const activeQueues = this.queuesService.getAllQueues();
      const metricsList: any[] = [];

      // Get DLQ count
      let dlqCount = 0;
      const dlq = this.queuesService.getQueue('dead_letter_queue');
      if (dlq) {
        dlqCount = await dlq.getWaitingCount();
      }

      // Mocked worker reports for evaluation (WorkersService broadcasts real ones)
      const config = this.queuesService.simConfig.getConfig();
      const queueNames = ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'];
      const workerHealthList = queueNames.map((name) => {
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
          queueName: name as QueueName,
          status,
          concurrency: name === 'email_notifications' ? 2 : 5,
          cpuUsage: Math.round(cpuUsage),
          memoryUsage: Math.round(memoryUsage),
          lastActive: Date.now(),
        };
      });

      for (const [name, queue] of activeQueues) {
        if (name === 'dead_letter_queue') continue;

        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);

        const isPaused = await queue.isPaused();

        // 1. Calculate Average Latency
        const latencies = this.latencyWindow.get(name) || [];
        const averageLatency = latencies.length > 0
          ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
          : 0;

        // 2. Calculate Throughput
        const tickCount = this.completedTick.get(name) || 0;
        const throughput = tickCount * 30; // convert jobs/2s to jobs/min
        this.completedTick.set(name, 0); // reset tick

        const totalJobs = completed + failed;
        const failureRate = totalJobs > 0 ? (failed / totalJobs) * 100 : 0;
        const retryRate = failed > 0 ? (failed / totalJobs) * 50 : 0;

        // Worker health score calculation
        const matchingWorker = workerHealthList.find(w => w.queueName === name);
        let workerHealthScore = 100;
        if (matchingWorker) {
          if (matchingWorker.status === 'down') workerHealthScore = 0;
          else if (matchingWorker.status === 'overloaded') workerHealthScore = 50;
        }

        metricsList.push({
          queueName: name,
          waitingCount: waiting,
          activeCount: active,
          completedCount: completed,
          failedCount: failed,
          delayedCount: delayed,
          paused: isPaused,
          throughput: throughput,
          averageLatency: averageLatency || 0,
          failureRate: Math.round(failureRate),
          retryRate: Math.round(retryRate),
          backlogGrowth: waiting > 10 ? Math.round(waiting * 0.15) : 0,
          deadLetterCount: dlqCount,
          workerHealthScore,
          timestamp: Date.now(),
        });
      }

      // Stream metrics update using V1 websocket event: metrics.updated
      this.wsGateway.broadcast('metrics.updated', metricsList);

      // Save the latest real metrics to Redis for REST endpoint consumption
      const redis = this.queuesService.getRedisConnection();
      if (redis) {
        await redis.set('queuewatch:global:queue_metrics', JSON.stringify(metricsList));
      }

      // Invoke incident detector
      await this.incidentsService.evaluateSystemState(metricsList, workerHealthList, dlqCount);

      // Evaluate alert rules
      await this.alertsService.evaluateRules(metricsList);
    } catch (err) {
      this.logger.error('Failed to run metrics aggregation:', err.message);
    }
  }
}
