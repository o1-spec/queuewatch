import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import { QueuesService } from '../queues/queues.service';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';

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
    private wsGateway: QueueWebSocketGateway
  ) {
    const queueNames = ['email_queue', 'image_processing_queue', 'webhook_delivery_queue', 'ai_task_queue'];
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

        metricsList.push({
          queueName: name,
          waitingCount: waiting,
          activeCount: active,
          completedCount: completed,
          failedCount: failed,
          delayedCount: delayed,
          paused: isPaused,
          throughput: this.queuesService.simConfig.getConfig().generateTraffic && throughput === 0
            ? Math.round(15 + Math.random() * 15) // Seed a small workload visual if traffic is active but tick was empty
            : throughput,
          averageLatency: averageLatency || Math.round(800 + Math.random() * 300),
          timestamp: Date.now(),
        });
      }

      // Stream to Socket.IO connected clients
      this.wsGateway.broadcast('queue.metrics.updated', metricsList);
    } catch (err) {
      this.logger.error('Failed to run metrics aggregation:', err.message);
    }
  }
}
