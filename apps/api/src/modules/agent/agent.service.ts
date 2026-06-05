import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { QueuesService } from '../queues/queues.service';
import { WorkersService } from '../workers/workers.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { AiService } from '../ai/ai.service';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';
import { InvestigationReport, QueueName } from '@queuewatch/shared';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly dbService: DbService,
    @Inject(forwardRef(() => QueuesService))
    private readonly queuesService: QueuesService,
    @Inject(forwardRef(() => WorkersService))
    private readonly workersService: WorkersService,
    private readonly telemetryService: TelemetryService,
    private readonly aiService: AiService,
    private readonly wsGateway: QueueWebSocketGateway
  ) {}

  // --- Step-by-Step Diagnostic Toolset ---

  async getIncident(id: string, projectId: string) {
    return this.dbService.getIncident(id, projectId);
  }

  async getQueueMetrics(queueName: string, projectId: string) {
    const list = await this.queuesService.getQueuesList(projectId);
    return list.find(q => q.name === queueName) || null;
  }

  async getFailedJobs(queueName: string) {
    const allJobs = await this.queuesService.getQueueJobs(queueName, 20);
    return allJobs.filter(j => j.status === 'failed');
  }

  async getRetryHistory(queueName: string, projectId: string) {
    const allTelemetry = await this.telemetryService.getQueueEvents(queueName as QueueName, 50, projectId);
    return allTelemetry.filter(t => t.type === 'job.failed');
  }

  async getWorkerHealth(queueName: string, projectId: string) {
    const allWorkers = await this.workersService.getWorkersList(projectId);
    return allWorkers.find(w => w.queueName === queueName) || null;
  }

  async getDeadLetterJobs(queueName: string, projectId: string) {
    const allDLQ = await this.dbService.getDeadLetterJobs(projectId);
    return allDLQ.filter(job => job.queueName === queueName);
  }

  async getRecentLogs(queueName: string, projectId: string) {
    return this.dbService.getLogs(queueName, 30, projectId);
  }

  async getRecentTelemetry(queueName: string, projectId: string) {
    return this.telemetryService.getQueueEvents(queueName as QueueName, 30, projectId);
  }

  /**
   * Executes the full diagnostic investigation workflow.
   */
  async runInvestigation(incidentId: string, projectId: string): Promise<InvestigationReport> {
    this.logger.log(`[Agent] Initiating step-by-step investigation for incident: ${incidentId} in project ${projectId}`);
    
    // Broadcast progress
    this.wsGateway.broadcast('investigation.progress', { incidentId, status: 'investigating', progress: 10, step: 'GATHERING_INCIDENT_DATA' });

    const incident = await this.getIncident(incidentId, projectId);
    if (!incident) {
      throw new Error(`Incident with ID ${incidentId} not found`);
    }

    const q = incident.affectedQueue;

    // Step 2: Query tools
    this.wsGateway.broadcast('investigation.progress', { incidentId, status: 'investigating', progress: 30, step: 'QUERYING_METRICS_AND_HEALTH' });
    const metrics = await this.getQueueMetrics(q, projectId);
    const workerHealth = await this.getWorkerHealth(q, projectId);

    // Step 3: Query failed states and retries
    this.wsGateway.broadcast('investigation.progress', { incidentId, status: 'investigating', progress: 50, step: 'ANALYZING_RETRYS_AND_DLQ' });
    const failedJobs = await this.getFailedJobs(q);
    const retryHistory = await this.getRetryHistory(q, projectId);
    const deadLetterJobs = await this.getDeadLetterJobs(q, projectId);

    // Step 4: Gather logs and telemetry traces
    this.wsGateway.broadcast('investigation.progress', { incidentId, status: 'investigating', progress: 70, step: 'GATHERING_TELEMETRY_LOG_TRACES' });
    const logs = await this.getRecentLogs(q, projectId);
    const telemetry = await this.getRecentTelemetry(q, projectId);

    const context = {
      incident,
      metrics,
      workerHealth,
      failedJobs,
      retryHistory,
      deadLetterJobs,
      logs,
      telemetry,
    };

    // Step 5: Ask AI Service to analyze gathered evidence
    this.wsGateway.broadcast('investigation.progress', { incidentId, status: 'investigating', progress: 90, step: 'INVOKING_AI_SRE_AUDITOR' });
    
    const aiResult = await this.aiService.investigateIncident(context);

    // Step 6: Create and save report
    const report: InvestigationReport = {
      id: `rep_${Math.random().toString(36).substr(2, 9)}`,
      incidentId,
      rootCause: aiResult.rootCause,
      impact: aiResult.impact,
      confidenceScore: aiResult.confidenceScore,
      evidence: aiResult.evidence,
      recommendedActions: aiResult.recommendedActions,
      timelineSummary: aiResult.timelineSummary,
      nextSteps: aiResult.nextSteps,
      timestamp: Date.now(),
    };

    await this.dbService.saveInvestigation(report, projectId);

    // Broadcast completion
    this.wsGateway.broadcast('investigation.progress', { incidentId, status: 'completed', progress: 100, step: 'COMPLETED', report });
    this.wsGateway.broadcast('investigation.completed', report);

    return report;
  }
}
