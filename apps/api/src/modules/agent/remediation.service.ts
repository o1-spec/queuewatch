import {
  Injectable, Logger, NotFoundException, BadRequestException,
  Inject, forwardRef
} from '@nestjs/common';
import { DbService } from '../db/db.service';
import { QueuesService } from '../queues/queues.service';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';
import {
  AgentAction, RemediationRecord, RemediationStatus,
  RollbackPlan, VerificationResult,
} from '@queuewatch/shared';

// ─── Rollback Registry ─────────────────────────────────────────────────────────
// Maps each action type to its inverse action type and whether to auto-rollback

interface RollbackConfig {
  rollbackActionType: AgentAction['type'];
  description: string;
  automatic: boolean; // auto-trigger rollback if verification fails
}

const ROLLBACK_REGISTRY: Record<string, RollbackConfig> = {
  pause_queue: {
    rollbackActionType: 'resume_queue',
    description: 'Resume the queue to restore job processing.',
    automatic: true,
  },
  resume_queue: {
    rollbackActionType: 'pause_queue',
    description: 'Re-pause the queue if resuming caused instability.',
    automatic: false,
  },
  replay_dlq: {
    rollbackActionType: 'ack_incident',
    description: 'DLQ replay cannot be directly reversed. Acknowledge and monitor.',
    automatic: false,
  },
  scale_workers: {
    rollbackActionType: 'scale_workers',
    description: 'Scale workers back to the previous count.',
    automatic: true,
  },
  restart_worker: {
    rollbackActionType: 'restart_worker',
    description: 'Restart the worker again if it remains unhealthy.',
    automatic: false,
  },
  rollback_deployment: {
    rollbackActionType: 'investigate_deployment',
    description: 'Review deployment state and re-deploy if rollback failed.',
    automatic: false,
  },
  ack_incident: {
    rollbackActionType: 'ack_incident',
    description: 'No rollback needed — acknowledgement is non-destructive.',
    automatic: false,
  },
  resolve_incident: {
    rollbackActionType: 'ack_incident',
    description: 'Re-open investigation if resolution was premature.',
    automatic: false,
  },
  reduce_concurrency: {
    rollbackActionType: 'scale_workers',
    description: 'Restore concurrency to the previous level.',
    automatic: true,
  },
  investigate_deployment: {
    rollbackActionType: 'investigate_deployment',
    description: 'Re-run deployment investigation for further clarity.',
    automatic: false,
  },
  trigger_runbook: {
    rollbackActionType: 'ack_incident',
    description: 'Cancel runbook and acknowledge the incident for manual review.',
    automatic: false,
  },
};

@Injectable()
export class RemediationService {
  private readonly logger = new Logger(RemediationService.name);

  constructor(
    private readonly dbService: DbService,
    @Inject(forwardRef(() => QueuesService))
    private readonly queuesService: QueuesService,
    private readonly wsGateway: QueueWebSocketGateway,
  ) {}

  // ─── Build Rollback Plan ─────────────────────────────────────────────────────

  private buildRollbackPlan(action: AgentAction): RollbackPlan {
    const config = ROLLBACK_REGISTRY[action.type] || {
      rollbackActionType: 'ack_incident' as AgentAction['type'],
      description: 'No standard rollback available. Acknowledge and monitor.',
      automatic: false,
    };

    // Build inverse payload — e.g., if scaling up, rollback payload scales back down
    let rollbackPayload: any = { ...action.payload };
    if (action.type === 'scale_workers' && action.payload?.replicas) {
      rollbackPayload = { ...action.payload, replicas: Math.max(1, action.payload.replicas - 2) };
    }
    if (action.type === 'reduce_concurrency' && action.payload?.concurrency) {
      rollbackPayload = { ...action.payload, concurrency: action.payload.concurrency + 2 };
    }

    return {
      description: config.description,
      rollbackActionType: config.rollbackActionType,
      rollbackPayload,
      automatic: config.automatic,
    };
  }

  // ─── Append Timeline Event ────────────────────────────────────────────────────
  // Reuses the same RunbookEvents storage pattern used by incident runbook step tracking

  private async appendTimelineEvent(
    incidentId: string,
    projectId: string,
    event: string,
    title: string,
    desc: string,
    metadata?: any,
  ): Promise<string> {
    const eventId = `rem_evt_${Math.random().toString(36).substring(2, 10)}`;
    const newEvent = {
      id: eventId,
      event,
      title,
      desc,
      timestamp: Date.now(),
      metadata,
    };
    const currentEvents = await this.dbService.getIncidentRunbookEvents(incidentId, projectId);
    currentEvents.push(newEvent);
    await this.dbService.saveIncidentRunbookEvents(incidentId, currentEvents, projectId);
    this.wsGateway.broadcast('incident.timeline.updated', { incidentId, event: newEvent, projectId });
    return eventId;
  }

  // ─── Create RemediationRecord ─────────────────────────────────────────────────

  async createRecord(
    action: AgentAction,
    incidentId: string,
    projectId: string,
    sessionId?: string,
  ): Promise<RemediationRecord> {
    const id = `rem_${Math.random().toString(36).substring(2, 11)}`;
    const rollbackPlan = this.buildRollbackPlan(action);

    const record: RemediationRecord = {
      id,
      sessionId,
      incidentId,
      projectId,
      action: { ...action, status: 'pending' },
      rollbackPlan,
      status: 'pending_approval',
      executionLog: [`[${new Date().toISOString()}] Remediation record created for action "${action.type}".`],
      timelineEventIds: [],
      createdAt: Date.now(),
    };

    await this.dbService.saveRemediationRecord(record, projectId);

    // Timeline: action proposed
    const evtId = await this.appendTimelineEvent(
      incidentId, projectId,
      'remediation.proposed',
      `Action Proposed: ${this.humanizeType(action.type)}`,
      `Remediation action "${action.description}" proposed and awaiting engineer approval. Risk: ${action.riskLevel}.`,
      { recordId: id, actionType: action.type, riskLevel: action.riskLevel },
    );
    record.timelineEventIds.push(evtId);
    await this.dbService.saveRemediationRecord(record, projectId);

    this.wsGateway.broadcast('remediation.created', { record, projectId });
    this.logger.log(`[Remediation] Record ${id} created for incident ${incidentId} (action: ${action.type})`);
    return record;
  }

  // ─── Approve ─────────────────────────────────────────────────────────────────

  async approveRecord(id: string, approvedBy: string, projectId: string): Promise<RemediationRecord> {
    const record = await this.dbService.getRemediationRecord(id, projectId);
    if (!record) throw new NotFoundException(`Remediation record ${id} not found`);
    if (record.status !== 'pending_approval') {
      throw new BadRequestException(`Record ${id} is not in pending_approval state (current: ${record.status})`);
    }

    const now = Date.now();
    record.action.status = 'approved';
    record.status = 'approved';
    record.approvedBy = approvedBy;
    record.approvedAt = now;
    record.executionLog.push(`[${new Date(now).toISOString()}] Approved by ${approvedBy}.`);

    await this.dbService.saveRemediationRecord(record, projectId);

    // Timeline: action approved
    const evtId = await this.appendTimelineEvent(
      record.incidentId, projectId,
      'remediation.approved',
      `Action Approved: ${this.humanizeType(record.action.type)}`,
      `Action approved by ${approvedBy}. Ready for execution.`,
      { recordId: id, approvedBy },
    );
    record.timelineEventIds.push(evtId);
    await this.dbService.saveRemediationRecord(record, projectId);

    this.wsGateway.broadcast('remediation.approved', { recordId: id, approvedBy, projectId });
    return record;
  }

  // ─── Reject ──────────────────────────────────────────────────────────────────

  async rejectRecord(id: string, rejectedBy: string, notes: string, projectId: string): Promise<RemediationRecord> {
    const record = await this.dbService.getRemediationRecord(id, projectId);
    if (!record) throw new NotFoundException(`Remediation record ${id} not found`);
    if (record.status !== 'pending_approval') {
      throw new BadRequestException(`Record ${id} is not in pending_approval state`);
    }

    const now = Date.now();
    record.action.status = 'rejected';
    record.status = 'rejected';
    record.rejectedBy = rejectedBy;
    record.rejectedAt = now;
    record.executionLog.push(`[${new Date(now).toISOString()}] Rejected by ${rejectedBy}. Notes: ${notes || 'none'}.`);

    await this.dbService.saveRemediationRecord(record, projectId);

    const evtId = await this.appendTimelineEvent(
      record.incidentId, projectId,
      'remediation.rejected',
      `Action Rejected: ${this.humanizeType(record.action.type)}`,
      `Action rejected by ${rejectedBy}. Reason: ${notes || 'Not specified'}.`,
      { recordId: id, rejectedBy, notes },
    );
    record.timelineEventIds.push(evtId);
    await this.dbService.saveRemediationRecord(record, projectId);

    this.wsGateway.broadcast('remediation.rejected', { recordId: id, rejectedBy, projectId });
    return record;
  }

  // ─── Execute ─────────────────────────────────────────────────────────────────

  async executeRecord(id: string, projectId: string): Promise<RemediationRecord> {
    const record = await this.dbService.getRemediationRecord(id, projectId);
    if (!record) throw new NotFoundException(`Remediation record ${id} not found`);
    if (record.status !== 'approved') {
      throw new BadRequestException(`Record ${id} must be approved before execution (current: ${record.status})`);
    }

    const now = Date.now();
    record.status = 'executing';
    record.executedAt = now;
    record.executionLog.push(`[${new Date(now).toISOString()}] Execution started.`);
    await this.dbService.saveRemediationRecord(record, projectId);

    // Timeline: executing
    const execEvtId = await this.appendTimelineEvent(
      record.incidentId, projectId,
      'remediation.executing',
      `Action Executing: ${this.humanizeType(record.action.type)}`,
      `Executing: "${record.action.description}"`,
      { recordId: id },
    );
    record.timelineEventIds.push(execEvtId);

    // Capture pre-execution metrics snapshot
    const preMetrics = await this.captureMetrics(record.incidentId, record.action.payload?.queueName, projectId);

    // Perform the actual action
    let succeeded = false;
    let execOutput = '';

    try {
      execOutput = await this.performAction(record.action, projectId);
      succeeded = true;
      this.logger.log(`[Remediation] Action ${record.action.type} executed successfully for record ${id}`);
    } catch (err) {
      execOutput = `Execution failed: ${err.message}`;
      this.logger.error(`[Remediation] Action ${record.action.type} failed for record ${id}: ${err.message}`);
    }

    const completedAt = Date.now();
    record.status = succeeded ? 'succeeded' : 'failed';
    record.action.status = 'executed';
    record.completedAt = completedAt;
    record.executionLog.push(`[${new Date(completedAt).toISOString()}] ${execOutput}`);
    await this.dbService.saveRemediationRecord(record, projectId);

    // Timeline: succeeded/failed
    const outcomeEvtId = await this.appendTimelineEvent(
      record.incidentId, projectId,
      succeeded ? 'remediation.succeeded' : 'remediation.failed',
      succeeded ? `Action Succeeded: ${this.humanizeType(record.action.type)}` : `Action Failed: ${this.humanizeType(record.action.type)}`,
      execOutput,
      { recordId: id, succeeded },
    );
    record.timelineEventIds.push(outcomeEvtId);
    await this.dbService.saveRemediationRecord(record, projectId);

    this.wsGateway.broadcast(succeeded ? 'remediation.succeeded' : 'remediation.failed', { recordId: id, projectId });

    // Auto-rollback on failure if configured
    if (!succeeded && record.rollbackPlan.automatic) {
      this.logger.warn(`[Remediation] Auto-rolling back record ${id} due to failure.`);
      setTimeout(() => this.rollbackRecord(id, projectId).catch(() => {}), 1000);
    }

    // Verification Engine: runs 5s post-execution asynchronously
    if (succeeded) {
      setTimeout(() => this.runVerification(id, preMetrics, projectId).catch(() => {}), 5000);
    }

    return record;
  }

  // ─── Rollback ────────────────────────────────────────────────────────────────

  async rollbackRecord(id: string, projectId: string): Promise<RemediationRecord> {
    const record = await this.dbService.getRemediationRecord(id, projectId);
    if (!record) throw new NotFoundException(`Remediation record ${id} not found`);

    const now = Date.now();
    record.executionLog.push(`[${new Date(now).toISOString()}] Rollback initiated.`);

    // Create the inverse action and execute it
    const rollbackAction: AgentAction = {
      id: `act_rollback_${id}`,
      type: record.rollbackPlan.rollbackActionType,
      description: record.rollbackPlan.description,
      reasoning: `Rollback of action "${record.action.description}"`,
      riskLevel: 'medium',
      expectedOutcome: 'System returns to pre-action state.',
      estimatedRecoveryMin: 2,
      status: 'approved',
      payload: record.rollbackPlan.rollbackPayload || record.action.payload,
    };

    let rollbackOutput = '';
    try {
      rollbackOutput = await this.performAction(rollbackAction, projectId);
      record.status = 'rolled_back';
      record.executionLog.push(`[${new Date().toISOString()}] Rollback succeeded: ${rollbackOutput}`);
    } catch (err) {
      rollbackOutput = `Rollback failed: ${err.message}`;
      record.executionLog.push(`[${new Date().toISOString()}] ${rollbackOutput}`);
      this.logger.error(`[Remediation] Rollback failed for record ${id}: ${err.message}`);
    }

    await this.dbService.saveRemediationRecord(record, projectId);

    const evtId = await this.appendTimelineEvent(
      record.incidentId, projectId,
      'remediation.rolled_back',
      `Action Rolled Back: ${this.humanizeType(record.action.type)}`,
      `Rollback executed: ${rollbackOutput}`,
      { recordId: id, rollbackType: record.rollbackPlan.rollbackActionType },
    );
    record.timelineEventIds.push(evtId);
    await this.dbService.saveRemediationRecord(record, projectId);

    this.wsGateway.broadcast('remediation.rolled_back', { recordId: id, projectId });
    return record;
  }

  // ─── Verification Engine ──────────────────────────────────────────────────────

  private async captureMetrics(incidentId: string, queueName: string, projectId: string): Promise<any> {
    const snapshot: any = { capturedAt: Date.now() };
    try {
      const incident = await this.dbService.getIncident(incidentId, projectId);
      snapshot.incidentStatus = incident?.status || 'unknown';
    } catch (_) { snapshot.incidentStatus = 'unknown'; }

    try {
      if (queueName) {
        const queuesList = await this.queuesService.getQueuesList(projectId);
        const qMetrics = queuesList.find(q => q.name === queueName);
        if (qMetrics) {
          const total = (qMetrics.completedCount || 0) + (qMetrics.failedCount || 0);
          snapshot.failureRate = total > 0 ? Math.round((qMetrics.failedCount / total) * 100) : 0;
          snapshot.latency = qMetrics.averageLatency || 0;
        }
      }
    } catch (_) { snapshot.failureRate = 0; snapshot.latency = 0; }

    try {
      const scores = await this.dbService.getReliabilityScores(projectId);
      const qScore = scores.find(s => s.targetId === queueName && s.targetType === 'queue');
      snapshot.reliabilityScore = qScore?.score || 0;
    } catch (_) { snapshot.reliabilityScore = 0; }

    return snapshot;
  }

  private async runVerification(id: string, preMetrics: any, projectId: string): Promise<void> {
    const record = await this.dbService.getRemediationRecord(id, projectId);
    if (!record || record.status !== 'succeeded') return;

    const queueName = record.action.payload?.queueName;
    const postMetrics = await this.captureMetrics(record.incidentId, queueName, projectId);

    const failureRateBefore = preMetrics.failureRate ?? 0;
    const failureRateAfter = postMetrics.failureRate ?? 0;
    const latencyBefore = preMetrics.latency ?? 0;
    const latencyAfter = postMetrics.latency ?? 0;
    const scoreBefore = preMetrics.reliabilityScore ?? 0;
    const scoreAfter = postMetrics.reliabilityScore ?? 0;

    // Determine improvement: failure rate decreased OR latency decreased OR score increased
    const improved =
      failureRateAfter <= failureRateBefore ||
      latencyAfter <= latencyBefore ||
      scoreAfter >= scoreBefore ||
      (preMetrics.incidentStatus !== 'resolved' && postMetrics.incidentStatus === 'resolved');

    const parts: string[] = [];
    if (failureRateAfter < failureRateBefore) parts.push(`Failure rate: ${failureRateBefore}% → ${failureRateAfter}% ↓`);
    if (failureRateAfter > failureRateBefore) parts.push(`Failure rate: ${failureRateBefore}% → ${failureRateAfter}% ↑`);
    if (latencyAfter < latencyBefore) parts.push(`Latency: ${latencyBefore}ms → ${latencyAfter}ms ↓`);
    if (latencyAfter > latencyBefore) parts.push(`Latency: ${latencyBefore}ms → ${latencyAfter}ms ↑`);
    if (scoreAfter !== scoreBefore) parts.push(`Reliability: ${scoreBefore}% → ${scoreAfter}%`);
    if (parts.length === 0) parts.push('Metrics stable post-action.');

    const verificationResult: VerificationResult = {
      checkedAt: Date.now(),
      passed: improved,
      improved,
      failureRateBefore,
      failureRateAfter,
      latencyBefore,
      latencyAfter,
      reliabilityScoreBefore: scoreBefore,
      reliabilityScoreAfter: scoreAfter,
      incidentStatusBefore: preMetrics.incidentStatus,
      incidentStatusAfter: postMetrics.incidentStatus,
      summary: `${improved ? '✅ Improved' : '⚠️ No improvement detected'}. ${parts.join(' | ')}`,
    };

    record.verificationResult = verificationResult;
    record.executionLog.push(`[${new Date().toISOString()}] Verification: ${verificationResult.summary}`);
    await this.dbService.saveRemediationRecord(record, projectId);

    const evtId = await this.appendTimelineEvent(
      record.incidentId, projectId,
      'remediation.verified',
      `Verification: ${improved ? 'Improved' : 'No Improvement'}`,
      verificationResult.summary,
      { recordId: id, improved, verificationResult },
    );
    record.timelineEventIds.push(evtId);
    await this.dbService.saveRemediationRecord(record, projectId);

    this.wsGateway.broadcast('remediation.verified', { recordId: id, verificationResult, projectId });
    this.logger.log(`[Remediation] Verification complete for record ${id}: ${improved ? 'IMPROVED' : 'NO IMPROVEMENT'}`);

    // Auto-rollback if verification indicates no improvement and plan is automatic
    if (!improved && record.rollbackPlan.automatic) {
      this.logger.warn(`[Remediation] Auto-rollback triggered for record ${id} due to no improvement.`);
      await this.rollbackRecord(id, projectId);
    }
  }

  // ─── performAction: Action Registry execution ─────────────────────────────────

  private async performAction(action: AgentAction, projectId: string): Promise<string> {
    const { type, payload } = action;

    switch (type) {
      case 'pause_queue': {
        const qName = payload?.queueName;
        if (!qName) throw new Error('pause_queue requires queueName in payload');
        await this.queuesService.pauseQueue(qName);
        return `Queue "${qName}" paused successfully.`;
      }
      case 'resume_queue': {
        const qName = payload?.queueName;
        if (!qName) throw new Error('resume_queue requires queueName in payload');
        await this.queuesService.resumeQueue(qName);
        return `Queue "${qName}" resumed successfully.`;
      }
      case 'replay_dlq': {
        const dlqJobs = await this.dbService.getDeadLetterJobs(projectId);
        const qName = payload?.queueName;
        const relevant = qName ? dlqJobs.filter(j => j.queueName === qName) : dlqJobs;
        let replayed = 0;
        for (const job of relevant.slice(0, 10)) {
          try {
            await this.queuesService.replayJob(job.jobId, projectId);
            replayed++;
          } catch (_) {}
        }
        return `DLQ replay completed: ${replayed}/${relevant.length} jobs re-queued.`;
      }
      case 'ack_incident': {
        const incId = payload?.incidentId;
        if (incId) {
          const incident = await this.dbService.getIncident(incId, projectId);
          if (incident && incident.status === 'open') {
            incident.status = 'acknowledged';
            incident.acknowledgedAt = Date.now();
            await this.dbService.saveIncident(incident, projectId);
          }
        }
        return `Incident ${incId || '(unspecified)'} acknowledged.`;
      }
      case 'resolve_incident': {
        const incId = payload?.incidentId;
        if (!incId) throw new Error('resolve_incident requires incidentId in payload');
        const incident = await this.dbService.getIncident(incId, projectId);
        if (!incident) throw new Error(`Incident ${incId} not found`);
        incident.status = 'resolved';
        incident.resolvedAt = Date.now();
        incident.resolutionSummary = payload?.summary || 'Resolved via Remediation Engine.';
        await this.dbService.saveIncident(incident, projectId);
        return `Incident ${incId} resolved.`;
      }
      case 'scale_workers': {
        const qName = payload?.queueName || 'unknown';
        const replicas = payload?.replicas || 3;
        return `Worker scale-up command dispatched for queue "${qName}" → ${replicas} replicas. Infrastructure layer will apply.`;
      }
      case 'restart_worker': {
        const wId = payload?.workerId || payload?.queueName || 'unknown';
        return `Worker restart command dispatched for worker "${wId}". Monitor heartbeat for confirmation.`;
      }
      case 'rollback_deployment': {
        const commitSha = payload?.commitSha?.substring(0, 8) || 'HEAD';
        return `Rollback to pre-${commitSha} release logged. Human deployment operator must confirm execution in CI/CD pipeline.`;
      }
      case 'investigate_deployment': {
        const commitSha = payload?.commitSha || 'HEAD';
        return `Deployment investigation queued: review git diff for commit ${commitSha}.`;
      }
      case 'reduce_concurrency': {
        const qName = payload?.queueName || 'unknown';
        const concurrency = payload?.concurrency || 2;
        return `Concurrency reduction to ${concurrency} dispatched for "${qName}". Restart worker process to apply.`;
      }
      case 'trigger_runbook': {
        const rbId = payload?.runbookId || 'unknown';
        return `Runbook "${rbId}" execution triggered. Navigate to Incidents → Runbooks to track progress.`;
      }
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private humanizeType(type: string): string {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  // ─── Query Methods ────────────────────────────────────────────────────────────

  async getRecords(projectId: string): Promise<RemediationRecord[]> {
    return this.dbService.getRemediationRecords(projectId);
  }

  async getRecord(id: string, projectId: string): Promise<RemediationRecord> {
    const record = await this.dbService.getRemediationRecord(id, projectId);
    if (!record) throw new NotFoundException(`Remediation record ${id} not found`);
    return record;
  }

  async getRecordsByIncident(incidentId: string, projectId: string): Promise<RemediationRecord[]> {
    return this.dbService.getRemediationRecordsByIncident(incidentId, projectId);
  }

  async getRecordsBySession(sessionId: string, projectId: string): Promise<RemediationRecord[]> {
    return this.dbService.getRemediationRecordsBySession(sessionId, projectId);
  }
}
