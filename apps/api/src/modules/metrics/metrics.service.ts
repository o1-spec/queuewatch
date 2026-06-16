import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject, forwardRef } from '@nestjs/common';
import { QueuesService } from '../queues/queues.service';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';
import { IncidentsService } from '../incidents/incidents.service';
import { AlertsService } from '../alerts/alerts.service';
import { DbService } from '../db/db.service';

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private timer: NodeJS.Timeout;
  private incidentTimer: NodeJS.Timeout;

  // Sliding window latency registers — lazily populated per real telemetry
  private latencyWindow = new Map<string, number[]>();
  private completedTick = new Map<string, number>();

  constructor(
    @Inject(forwardRef(() => QueuesService))
    private queuesService: QueuesService,
    private wsGateway: QueueWebSocketGateway,
    @Inject(forwardRef(() => IncidentsService))
    private incidentsService: IncidentsService,
    private alertsService: AlertsService,
    private dbService: DbService
  ) {}

  onModuleInit() {
    // Metrics broadcast: every 2s for real-time charts
    this.timer = setInterval(() => this.collectMetrics(), 2000);
    // Incident evaluation: every 30s — avoids hammering Redis with SRE rule checks
    this.incidentTimer = setInterval(() => this.runIncidentEvaluation(), 30_000);
    this.logger.log('Metrics aggregation engine running. Compiling telemetry...');
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.incidentTimer) clearInterval(this.incidentTimer);
  }

  recordLatency(queueName: string, duration: number) {
    const buffer = this.latencyWindow.get(queueName) || [];
    buffer.push(duration);
    if (buffer.length > 30) buffer.shift(); // keep last 30 samples
    this.latencyWindow.set(queueName, buffer);

    const count = this.completedTick.get(queueName) || 0;
    this.completedTick.set(queueName, count + 1);
  }

  // ─── Fast path: 2s metrics broadcast ────────────────────────────────────────
  private async collectMetrics() {
    try {
      const projects = await this.dbService.getAllProjects();
      const projectIds = projects.length > 0 ? projects.map(p => p.id) : ['proj_demo'];

      for (const projectId of projectIds) {
        const activeQueueNames = await this.dbService.getProjectQueues(projectId);
        const workerHealthList = await this.dbService.getWorkers(projectId);

        // DLQ count
        let dlqCount = 0;
        if (projectId === 'proj_demo') {
          const dlq = this.queuesService.getQueue('dead_letter_queue');
          if (dlq) dlqCount = await dlq.getWaitingCount();
        } else {
          const dlqJobs = await this.dbService.getDeadLetterJobs(projectId);
          dlqCount = dlqJobs.length;
        }

        // Seed fallback queue names for demo project before any BullMQ queues exist
        let queueNames = [...activeQueueNames];
        if (projectId === 'proj_demo' && queueNames.length === 0) {
          queueNames = ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'];
        }

        const metricsList: any[] = [];

        for (const name of queueNames) {
          if (name === 'dead_letter_queue') continue;

          // Shared: latency + throughput
          const latencies = this.latencyWindow.get(name) || [];
          const averageLatency = latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : 0;
          const tickCount = this.completedTick.get(name) || 0;
          const throughput = tickCount * 30; // jobs/2s → jobs/min
          this.completedTick.set(name, 0);

          // Shared: worker health score
          const matchingWorker = workerHealthList.find(w => w.queueName === name);
          let workerHealthScore = 100;
          if (matchingWorker) {
            if (matchingWorker.status === 'down') workerHealthScore = 0;
            else if (matchingWorker.status === 'overloaded') workerHealthScore = 50;
          }

          if (projectId === 'proj_demo') {
            // ── Demo path: read counts from BullMQ queue objects ──
            const queue = this.queuesService.getQueue(name);
            if (!queue) continue; // BullMQ queue not initialised yet

            const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
              queue.getWaitingCount(),
              queue.getActiveCount(),
              queue.getCompletedCount(),
              queue.getFailedCount(),
              queue.getDelayedCount(),
              queue.isPaused(),
            ]);

            const totalJobs = completed + failed;
            const failureRate = totalJobs > 0 ? (failed / totalJobs) * 100 : 0;
            const retryRate = failed > 0 ? (failed / totalJobs) * 50 : 0;
            const simConfig = this.queuesService.simConfig.getConfig();

            metricsList.push({
              projectId,
              queueName: name,
              waitingCount: waiting,
              activeCount: active,
              completedCount: completed,
              failedCount: failed,
              delayedCount: delayed,
              paused: isPaused,
              throughput: simConfig.generateTraffic && throughput === 0
                ? Math.round(15 + Math.random() * 15)
                : throughput,
              averageLatency: averageLatency || Math.round(800 + Math.random() * 300),
              failureRate: Math.round(failureRate),
              retryRate: Math.round(retryRate),
              backlogGrowth: waiting > 10 ? Math.round(waiting * 0.15) : 0,
              deadLetterCount: dlqCount,
              workerHealthScore,
              timestamp: Date.now(),
            });
          } else {
            // ── SDK path: derive counts from ingested telemetry events ──
            const telemetry = await this.dbService.getTelemetryByQueue(name, 500, projectId);

            // Telemetry is lpush'd (newest first). Scan in reverse so that the
            // last write per jobId = its most recent known state.
            const jobStatuses = new Map<string, string>();
            for (let i = telemetry.length - 1; i >= 0; i--) {
              const event = telemetry[i];
              if (event.jobId) jobStatuses.set(event.jobId, event.type);
            }

            let waiting = 0, active = 0, completed = 0, failed = 0, delayed = 0;
            for (const type of jobStatuses.values()) {
              if (type === 'job.created') waiting++;
              else if (type === 'job.active') active++;
              else if (type === 'job.completed') completed++;
              else if (type === 'job.failed') failed++;
              else if (type === 'job.delayed') delayed++;
            }

            const totalJobs = completed + failed;
            const failureRate = totalJobs > 0 ? (failed / totalJobs) * 100 : 0;
            const retryRate = failed > 0 ? (failed / totalJobs) * 50 : 0;

            metricsList.push({
              projectId,
              queueName: name,
              waitingCount: waiting,
              activeCount: active,
              completedCount: completed,
              failedCount: failed,
              delayedCount: delayed,
              paused: false,
              throughput,
              averageLatency,
              failureRate: Math.round(failureRate),
              retryRate: Math.round(retryRate),
              backlogGrowth: waiting > 10 ? Math.round(waiting * 0.15) : 0,
              deadLetterCount: dlqCount,
              workerHealthScore,
              timestamp: Date.now(),
            });
          }
        }

        this.wsGateway.broadcast('metrics.updated', metricsList);
        await this.alertsService.evaluateRules(metricsList);
      }
    } catch (err) {
      this.logger.error('Failed to run metrics aggregation:', err.message);
    }
  }

  // ─── Slow path: 30s incident evaluation ─────────────────────────────────────
  private async runIncidentEvaluation() {
    try {
      const projects = await this.dbService.getAllProjects();
      const projectIds = projects.length > 0 ? projects.map(p => p.id) : ['proj_demo'];

      for (const projectId of projectIds) {
        const activeQueueNames = await this.dbService.getProjectQueues(projectId);
        let queueNames = [...activeQueueNames];
        if (projectId === 'proj_demo' && queueNames.length === 0) {
          queueNames = ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'];
        }

        const workerHealthList = await this.dbService.getWorkers(projectId);

        let dlqCount = 0;
        if (projectId === 'proj_demo') {
          const dlq = this.queuesService.getQueue('dead_letter_queue');
          if (dlq) dlqCount = await dlq.getWaitingCount();
        } else {
          const dlqJobs = await this.dbService.getDeadLetterJobs(projectId);
          dlqCount = dlqJobs.length;
        }

        const metricsList: any[] = [];

        for (const name of queueNames) {
          if (name === 'dead_letter_queue') continue;

          const latencies = this.latencyWindow.get(name) || [];
          const averageLatency = latencies.length > 0
            ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
            : 0;

          let completed = 0, failed = 0;

          if (projectId === 'proj_demo') {
            const queue = this.queuesService.getQueue(name);
            if (queue) {
              [completed, failed] = await Promise.all([
                queue.getCompletedCount(),
                queue.getFailedCount(),
              ]);
            }
          } else {
            const telemetry = await this.dbService.getTelemetryByQueue(name, 500, projectId);
            const jobStatuses = new Map<string, string>();
            for (let i = telemetry.length - 1; i >= 0; i--) {
              const event = telemetry[i];
              if (event.jobId) jobStatuses.set(event.jobId, event.type);
            }
            for (const type of jobStatuses.values()) {
              if (type === 'job.completed') completed++;
              else if (type === 'job.failed') failed++;
            }
          }

          const totalJobs = completed + failed;
          const failureRate = totalJobs > 0 ? (failed / totalJobs) * 100 : 0;

          metricsList.push({
            projectId,
            queueName: name,
            completedCount: completed,
            failedCount: failed,
            failureRate: Math.round(failureRate),
            averageLatency,
            waitingCount: 0,
            timestamp: Date.now(),
          });
        }

        await this.incidentsService.evaluateSystemState(metricsList, workerHealthList, dlqCount, projectId);
      }
    } catch (err) {
      this.logger.error('Failed to run incident evaluation:', err.message);
    }
  }
}
