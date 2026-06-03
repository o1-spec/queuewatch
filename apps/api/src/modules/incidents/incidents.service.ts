import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Incident, QueueName } from '@queuewatch/shared';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';
import { AiService } from '../ai/ai.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { DbService } from '../db/db.service';

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private wsGateway: QueueWebSocketGateway,
    @Inject(forwardRef(() => AiService))
    private aiService: AiService,
    private telemetryService: TelemetryService,
    private dbService: DbService
  ) {}

  async getIncidents(): Promise<Incident[]> {
    const list = await this.dbService.getIncidents();
    return list.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
  }

  async getIncidentById(id: string): Promise<Incident | null> {
    return this.dbService.getIncident(id);
  }

  async createIncident(data: Omit<Incident, 'id' | 'firstDetectedAt' | 'lastUpdatedAt'>): Promise<Incident> {
    const id = `inc_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const newIncident: Incident = {
      ...data,
      id,
      firstDetectedAt: now,
      lastUpdatedAt: now,
    };

    await this.dbService.saveIncident(newIncident);
    this.wsGateway.broadcast('incident.created', newIncident);
    this.logger.warn(`[Incident] New incident created: ${newIncident.title} on queue ${newIncident.affectedQueue}`);
    return newIncident;
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident> {
    const existing = await this.dbService.getIncident(id);
    if (!existing) {
      throw new Error(`Incident with ID ${id} not found`);
    }

    const updated: Incident = {
      ...existing,
      ...updates,
      lastUpdatedAt: Date.now(),
    };

    await this.dbService.saveIncident(updated);
    this.wsGateway.broadcast('incident.updated', updated);
    this.logger.log(`[Incident] Incident updated: ${updated.id} (${updated.status})`);
    return updated;
  }

  async analyzeIncident(id: string): Promise<Incident> {
    const incident = await this.dbService.getIncident(id);
    if (!incident) {
      throw new Error(`Incident ${id} not found`);
    }

    this.logger.log(`[Incident] Running AI diagnostics for incident ${id}...`);
    
    const diagnosis = await this.aiService.diagnoseIncident(incident);

    const updated = await this.updateIncident(id, {
      summary: diagnosis.summary,
      suspectedRootCause: diagnosis.suspectedRootCause,
      recommendation: diagnosis.recommendation,
      impact: diagnosis.impact,
      severity: diagnosis.severity || incident.severity,
    });

    this.wsGateway.broadcast('ai.insight.generated', {
      incidentId: id,
      summary: updated.summary,
      recommendation: updated.recommendation,
      suspectedRootCause: updated.suspectedRootCause,
    });

    return updated;
  }

  async evaluateSystemState(metricsList: any[], workerHealthList: any[], dlqCount: number) {
    for (const worker of workerHealthList) {
      const qName = worker.queueName as QueueName;
      
      if (worker.status === 'down') {
        const title = `Worker thread offline on ${qName}`;
        let existing = await this.getOpenIncidentByTitle(title);
        if (!existing) {
          const matchingEvents = await this.telemetryService.getQueueEvents(qName, 5);
          const errors = matchingEvents
            .filter(e => e.type === 'job.failed' || e.type === 'job.deadlettered')
            .map(e => e.errorMessage || 'Unknown worker crash');

          await this.createIncident({
            title,
            severity: 'critical',
            affectedQueue: qName,
            status: 'open',
            summary: `Worker associated with queue ${qName} has stopped reporting health heartbeats.`,
            evidence: `Worker ID ${worker.workerId} status: down.`,
            suspectedRootCause: 'Underlying connection timeout, CPU throttling, or unhandled process exception.',
            recommendation: 'Check server resource usage, check Redis network socket state, and restart worker node processes.',
            impact: 'Background execution stalled. Workloads are buffering in Redis.',
            relatedErrors: errors.slice(0, 3),
          });
        }
      } else {
        const title = `Worker thread offline on ${qName}`;
        let existing = await this.getOpenIncidentByTitle(title);
        if (existing) {
          await this.updateIncident(existing.id, { status: 'resolved' });
        }
      }

      if (worker.status === 'overloaded' || worker.cpuUsage > 80) {
        const title = `Latency threshold bottleneck on ${qName}`;
        let existing = await this.getOpenIncidentByTitle(title);
        if (!existing) {
          await this.createIncident({
            title,
            severity: 'high',
            affectedQueue: qName,
            status: 'open',
            summary: `Processing latency on queue ${qName} is exceeding operational SLA bounds.`,
            evidence: `Worker CPU: ${worker.cpuUsage}%, Memory: ${worker.memoryUsage}%.`,
            suspectedRootCause: 'CPU saturation due to heavy payload computations or database locking delays.',
            recommendation: 'Scale queue concurrency factor or spin up additional worker instances.',
            impact: 'Job backlog growth speed increased. Slower page responses for end-users.',
            relatedErrors: [],
          });
        }
      } else {
        const title = `Latency threshold bottleneck on ${qName}`;
        let existing = await this.getOpenIncidentByTitle(title);
        if (existing && worker.cpuUsage < 50) {
          await this.updateIncident(existing.id, { status: 'resolved' });
        }
      }
    }

    for (const metric of metricsList) {
      const qName = metric.queueName as QueueName;

      const totalProcessed = metric.completedCount + metric.failedCount;
      const failureRate = totalProcessed > 0 ? (metric.failedCount / totalProcessed) * 100 : 0;
      
      if (metric.failedCount > 3 && failureRate > 15) {
        const title = `Elevated job execution failure rate on ${qName}`;
        let existing = await this.getOpenIncidentByTitle(title);
        if (!existing) {
          const matchingEvents = await this.telemetryService.getQueueEvents(qName, 10);
          const errors = matchingEvents
            .filter(e => e.type === 'job.failed' || e.type === 'job.deadlettered')
            .map(e => e.errorMessage || 'Execution failed');

          await this.createIncident({
            title,
            severity: 'high',
            affectedQueue: qName,
            status: 'open',
            summary: `Failure rate on ${qName} has reached ${Math.round(failureRate)}%.`,
            evidence: `Total Failed: ${metric.failedCount} out of ${totalProcessed} processed.`,
            suspectedRootCause: 'Persistent failures detected. Upstream API timeouts, missing validation keys, or database lock conditions.',
            recommendation: 'Check API credentials, review payload validator rules, or verify external provider availability.',
            impact: 'Transactions are failing to complete, resulting in retried queues and backlog growth.',
            relatedErrors: Array.from(new Set(errors)).slice(0, 5),
          });
        }
      }

      if (metric.waitingCount > 30) {
        const title = `Queue backlog backlog growth warning on ${qName}`;
        let existing = await this.getOpenIncidentByTitle(title);
        if (!existing) {
          await this.createIncident({
            title,
            severity: 'medium',
            affectedQueue: qName,
            status: 'open',
            summary: `Queue ${qName} backlog is buffering waiting jobs.`,
            evidence: `Current Waiting: ${metric.waitingCount} jobs. Throughput: ${metric.throughput} jobs/min.`,
            suspectedRootCause: 'Worker throughput is lower than the job production ingestion rate.',
            recommendation: 'Increase BullMQ concurrency settings or restart frozen queue processors.',
            impact: 'Processing delays for background tasks.',
            relatedErrors: [],
          });
        }
      } else {
        const title = `Queue backlog backlog growth warning on ${qName}`;
        let existing = await this.getOpenIncidentByTitle(title);
        if (existing && metric.waitingCount < 5) {
          await this.updateIncident(existing.id, { status: 'resolved' });
        }
      }
    }
  }

  private async getOpenIncidentByTitle(title: string): Promise<Incident | undefined> {
    const list = await this.dbService.getIncidents();
    return list.find((inc) => inc.title === title && inc.status === 'open');
  }
}
