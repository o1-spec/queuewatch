import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Incident, QueueName, IncidentComment } from '@queuewatch/shared';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';
import { AiService } from '../ai/ai.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { DbService } from '../db/db.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GitHubService } from '../integrations/github.service';
import { JiraService } from '../integrations/jira.service';

@Injectable()
export class IncidentsService {
  private readonly logger = new Logger(IncidentsService.name);

  constructor(
    private wsGateway: QueueWebSocketGateway,
    @Inject(forwardRef(() => AiService))
    private aiService: AiService,
    private telemetryService: TelemetryService,
    private dbService: DbService,
    private notificationsService: NotificationsService,
    private gitHubService: GitHubService,
    private jiraService: JiraService
  ) {}

  async getIncidents(projectId?: string): Promise<Incident[]> {
    const list = await this.dbService.getIncidents(projectId);
    return list.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
  }

  async getIncidentById(id: string, projectId?: string): Promise<Incident | null> {
    return this.dbService.getIncident(id, projectId);
  }

  async createIncident(data: Omit<Incident, 'id' | 'firstDetectedAt' | 'lastUpdatedAt'>, projectId?: string): Promise<Incident> {
    const id = `inc_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const newIncident: Incident = {
      ...data,
      id,
      firstDetectedAt: now,
      lastUpdatedAt: now,
      status: 'open',
    };

    await this.dbService.saveIncident(newIncident, projectId);
    this.wsGateway.broadcast('incident.created', { ...newIncident, projectId });
    this.logger.warn(`[Incident] New incident created: ${newIncident.title} on queue ${newIncident.affectedQueue}`);

    // Trigger alerts safely
    try {
      await this.notificationsService.sendIncidentAlert(newIncident);
    } catch (e) {
      this.logger.error('Failed to dispatch alert notifications for new incident:', e);
    }

    return newIncident;
  }

  async updateIncident(id: string, updates: Partial<Incident>, projectId?: string): Promise<Incident> {
    const existing = await this.dbService.getIncident(id, projectId);
    if (!existing) {
      throw new Error(`Incident with ID ${id} not found`);
    }

    const updated: Incident = {
      ...existing,
      ...updates,
      lastUpdatedAt: Date.now(),
    };

    await this.dbService.saveIncident(updated, projectId);
    this.wsGateway.broadcast('incident.updated', { ...updated, projectId });
    this.logger.debug(`[Incident] Incident updated: ${updated.id} (${updated.status})`);
    return updated;
  }

  async acknowledgeIncident(id: string, userId = 'admin', userName = 'Admin Owner', projectId?: string): Promise<Incident> {
    const incident = await this.dbService.getIncident(id, projectId);
    if (!incident) throw new Error(`Incident ${id} not found`);

    const updated = await this.updateIncident(id, {
      status: 'acknowledged',
      acknowledgedAt: Date.now(),
      assigneeId: userId,
      responseOwner: userName,
    }, projectId);

    this.wsGateway.broadcast('incident.acknowledged', { ...updated, projectId });
    return updated;
  }

  async assignIncident(id: string, userId: string, userName: string, projectId?: string): Promise<Incident> {
    const updated = await this.updateIncident(id, {
      assigneeId: userId,
      responseOwner: userName,
    }, projectId);
    this.wsGateway.broadcast('incident.assigned', { ...updated, projectId });
    return updated;
  }

  async escalateIncident(id: string, projectId?: string): Promise<Incident> {
    const incident = await this.dbService.getIncident(id, projectId);
    if (!incident) throw new Error(`Incident ${id} not found`);

    const updated = await this.updateIncident(id, {
      status: 'investigating',
      escalatedAt: Date.now(),
    }, projectId);

    this.wsGateway.broadcast('incident.escalated', { ...updated, projectId });

    // Send escalated alerts
    try {
      await this.notificationsService.sendIncidentAlert(updated, true);
    } catch (e) {
      this.logger.error('Failed to send escalated incident notifications:', e);
    }

    return updated;
  }

  async resolveIncident(id: string, summary: string, projectId?: string): Promise<Incident> {
    const incident = await this.dbService.getIncident(id, projectId);
    if (!incident) throw new Error(`Incident ${id} not found`);

    const now = Date.now();
    const ackTime = incident.acknowledgedAt ? Math.round((incident.acknowledgedAt - incident.firstDetectedAt) / 1000) : 0;
    const resTime = Math.round((now - incident.firstDetectedAt) / 1000);

    // 1. Generate postmortem summary using AI if available, else build a deterministic summary
    let resolutionSummary = '';
    try {
      resolutionSummary = await this.aiService.generatePostmortem(incident, summary, ackTime, resTime);
    } catch (e) {
      this.logger.warn(`AI postmortem failed: ${e.message}. Using fallback builder.`);
      resolutionSummary = `
### 📝 Incident Postmortem (System Fallback)
* **What Happened:** ${incident.title}. ${incident.summary}
* **Root Cause:** ${incident.suspectedRootCause}
* **Impact:** ${incident.impact}
* **Time to Acknowledge:** ${ackTime > 0 ? `${ackTime} seconds` : 'Immediate'}
* **Time to Resolve:** ${resTime} seconds
* **Actions Taken:** ${summary || 'Manual service restart and active queue buffers re-evaluated.'}
* **Prevention Recommendation:** ${incident.recommendation}
      `.trim();
    }

    const updated = await this.updateIncident(id, {
      status: 'resolved',
      resolvedAt: now,
      resolutionSummary,
    }, projectId);

    // V4: Automatically generate Knowledge Base entry on resolution
    try {
      await this.dbService.saveKnowledgeEntry({
        id: `know_${Math.random().toString(36).substr(2, 9)}`,
        title: `Resolution: ${incident.title}`,
        incidentId: incident.id,
        pattern: incident.title,
        rootCause: incident.suspectedRootCause || 'Unverified thread resource exception.',
        resolution: summary || 'Manual service restart.',
        preventionRecommendation: incident.recommendation || 'No custom recommendation.',
        createdAt: now,
      }, projectId);
      this.logger.log(`Automatically registered Knowledge Base entry for incident ${id}.`);
    } catch (e) {
      this.logger.error(`Failed to register knowledge base entry: ${e.message}`);
    }

    this.wsGateway.broadcast('incident.resolved', { ...updated, projectId });
    this.wsGateway.broadcast('postmortem.generated', { incidentId: id, resolutionSummary, projectId });
    return updated;
  }

  // --- External issue trackers ---
  async createGitHubIssue(id: string, projectId?: string): Promise<Incident> {
    const incident = await this.dbService.getIncident(id, projectId);
    if (!incident) throw new Error(`Incident ${id} not found`);

    const issueUrl = await this.gitHubService.createIssue(
      incident.id,
      `[QueueWatch] ${incident.title}`,
      incident.summary + '\n\n' + incident.evidence
    );

    return this.updateIncident(id, {
      githubIssueUrl: issueUrl,
    }, projectId);
  }

  async createJiraTicket(id: string, projectId?: string): Promise<Incident> {
    const incident = await this.dbService.getIncident(id, projectId);
    if (!incident) throw new Error(`Incident ${id} not found`);

    const ticketUrl = await this.jiraService.createTicket(
      incident.id,
      `[QueueWatch] ${incident.title}`,
      incident.summary + '\n\n' + incident.evidence
    );

    return this.updateIncident(id, {
      jiraTicketUrl: ticketUrl,
    }, projectId);
  }

  // --- Comments ---
  async getComments(incidentId: string, projectId?: string): Promise<IncidentComment[]> {
    return this.dbService.getComments(incidentId, projectId);
  }

  async addComment(incidentId: string, message: string, userId = 'admin', userName = 'Admin Owner', projectId?: string): Promise<IncidentComment> {
    const comment: IncidentComment = {
      id: `comment_${Math.random().toString(36).substr(2, 9)}`,
      incidentId,
      userId,
      userName,
      message,
      createdAt: Date.now(),
    };

    await this.dbService.saveComment(comment, projectId);
    this.wsGateway.broadcast('incident.comment.created', { ...comment, projectId });
    return comment;
  }

  async deleteComment(incidentId: string, commentId: string, projectId?: string) {
    await this.dbService.deleteComment(incidentId, commentId, projectId);
  }

  // --- Diagnostics with Deployments Correlation ---
  async analyzeIncident(id: string, projectId?: string): Promise<Incident> {
    const incident = await this.dbService.getIncident(id, projectId);
    if (!incident) {
      throw new Error(`Incident ${id} not found`);
    }

    this.logger.log(`[Incident] Running V3 AI diagnostics with deployment correlation for incident ${id}...`);
    
    // Correlate recent deployment events within last 30 minutes of first detected incident
    const allDeps = await this.dbService.getDeploymentEvents(projectId);
    const incidentTime = incident.firstDetectedAt;
    const windowStart = incidentTime - 30 * 60 * 1000;
    
    const correlatedDeps = allDeps.filter(
      (dep) => dep.deployedAt >= windowStart && dep.deployedAt <= incidentTime
    );

    let deploymentEvidenceText = '';
    if (correlatedDeps.length > 0) {
      deploymentEvidenceText = `\n[Correlation Engine] Found ${correlatedDeps.length} recent deployment(s) in 30-min window:\n` +
        correlatedDeps.map(d => `- Deployed Service ${d.service} (Version: ${d.version}, Commit: ${d.commitSha}) by ${d.deployedBy} at ${new Date(d.deployedAt).toLocaleTimeString()}`).join('\n');
    }

    const diagnosis = await this.aiService.diagnoseIncident(incident, deploymentEvidenceText);

    const updated = await this.updateIncident(id, {
      summary: diagnosis.summary,
      suspectedRootCause: diagnosis.suspectedRootCause,
      recommendation: diagnosis.recommendation,
      impact: diagnosis.impact,
      severity: diagnosis.severity || incident.severity,
      evidence: incident.evidence + (deploymentEvidenceText ? `\n${deploymentEvidenceText}` : ''),
    }, projectId);

    this.wsGateway.broadcast('ai.insight.generated', {
      incidentId: id,
      summary: updated.summary,
      recommendation: updated.recommendation,
      suspectedRootCause: updated.suspectedRootCause,
      projectId,
    });

    return updated;
  }

  async evaluateSystemState(metricsList: any[], workerHealthList: any[], dlqCount: number, projectId = 'proj_demo') {
    const capitalize = (s: string) => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    // 1. Worker offline > 60s (use lastHeartbeatAt from SDK — fallback to lastActive)
    for (const worker of workerHealthList) {
      const qName = worker.queueName;
      const heartbeatTime = worker.lastHeartbeatAt ?? worker.lastActive;
      const isOffline = (Date.now() - heartbeatTime) > 60_000;
      const fingerprint = `${projectId}:worker_offline:${qName}`;
      
      if (isOffline) {
        const elapsed = Math.round((Date.now() - heartbeatTime) / 1000);
        await this.triggerOrUpdateIncident(projectId, fingerprint, {
          title: `Worker offline on ${qName}`,
          severity: 'critical',
          affectedQueue: qName,
          summary: `The worker ${worker.workerId} processing queue ${qName} has not sent a heartbeat for ${elapsed}s (threshold: 60s).`,
          evidence: `Worker ID: ${worker.workerId}, Last Heartbeat: ${new Date(heartbeatTime).toLocaleTimeString()}, CPU: ${worker.cpuUsage}%, Memory: ${worker.memoryUsage}%.`,
          suspectedRootCause: 'Underlying worker thread process crash (OOM), host container restart, or network socket disconnection.',
          recommendation: 'Verify the worker server daemon processes are actively running and analyze node heap limits.',
          impact: 'Queue consumer thread execution is halted. Workloads will buffer until consumer workers check back in.',
          relatedErrors: [],
        });
      } else {
        await this.resolveIncidentByFingerprint(fingerprint, projectId);
      }
    }

    // 2. Failure rate > 10% & Queue latency > 5s
    for (const metric of metricsList) {
      const qName = metric.queueName;
      const totalProcessed = metric.completedCount + metric.failedCount;
      const failureRate = totalProcessed > 0 ? (metric.failedCount / totalProcessed) * 100 : 0;
      
      // Rule A: Failure rate > 10%
      const failFingerprint = `${projectId}:failure_rate:${qName}`;
      if (totalProcessed > 0 && failureRate > 10) {
        await this.triggerOrUpdateIncident(projectId, failFingerprint, {
          title: `High Failure Rate on ${qName}`,
          severity: 'high',
          affectedQueue: qName,
          summary: `The job failure rate on queue ${qName} is currently ${Math.round(failureRate)}%, exceeding the SLA threshold of 10%.`,
          evidence: `Failed jobs count: ${metric.failedCount} out of ${totalProcessed} total runs processed.`,
          suspectedRootCause: 'Persistent downstream exception triggers. Upstream service connection resets, authentication drops, or database transaction locks.',
          recommendation: 'Inspect exception traces on the Logs page or click on the queue inspector to check error codes.',
          impact: 'Active workflows are falling back to retry queues, leading to processing delays and dead-letter queue growth.',
          relatedErrors: [],
        });
      } else {
        await this.resolveIncidentByFingerprint(failFingerprint, projectId);
      }

      // Rule B: Queue latency > 5s
      const latencyFingerprint = `${projectId}:latency_spike:${qName}`;
      if (metric.averageLatency > 5000) {
        const formatted = capitalize(qName);
        await this.triggerOrUpdateIncident(projectId, latencyFingerprint, {
          title: `${formatted} Latency Spike`,
          severity: 'high',
          affectedQueue: qName,
          summary: `Average job latency on queue ${qName} has reached ${Math.round(metric.averageLatency / 1000)} seconds, exceeding the SLA threshold of 5s.`,
          evidence: `Average processing duration: ${metric.averageLatency} ms. Current backlog size: ${metric.waitingCount} waiting jobs.`,
          suspectedRootCause: 'Worker process thread limits saturation, slow third-party API response hooks, or resource exhaustion.',
          recommendation: 'Adjust worker concurrency pool scaling or deploy additional container instances.',
          impact: 'Background processes take longer to finish, delaying real-time event updates.',
          relatedErrors: [],
        });
      } else {
        await this.resolveIncidentByFingerprint(latencyFingerprint, projectId);
      }
    }

    // 3. DLQ size > 100
    const dlqFingerprint = `${projectId}:dlq_threshold:all`;
    if (dlqCount > 100) {
      await this.triggerOrUpdateIncident(projectId, dlqFingerprint, {
        title: `DLQ size exceeds SLA bounds on project`,
        severity: 'high',
        affectedQueue: 'dead_letter_queue',
        summary: `The dead-letter queue job count is currently ${dlqCount}, exceeding the alert threshold of 100.`,
        evidence: `Total dead-letter jobs: ${dlqCount}.`,
        suspectedRootCause: 'Repeated job execution failures resulting in permanent dead-letter drops.',
        recommendation: 'Go to the Dead-Letter Queue page to audit and retry or purge failed jobs.',
        impact: 'Risk of permanent transactional failures and processing gaps.',
        relatedErrors: [],
      });
    } else {
      await this.resolveIncidentByFingerprint(dlqFingerprint, projectId);
    }

    // Run V3 escalation rule evaluation (project-scoped)
    await this.checkEscalations(projectId);
  }

  async checkEscalations(projectId?: string) {
    try {
      const rules = await this.dbService.getEscalationRules(projectId);
      const openIncidents = (await this.dbService.getIncidents(projectId)).filter(
        i => i.status === 'open' || i.status === 'investigating'
      );
      const now = Date.now();

      for (const incident of openIncidents) {
        for (const rule of rules) {
          if (!rule.enabled) continue;

          // Match queue
          if (rule.queueName !== 'all' && rule.queueName !== incident.affectedQueue) continue;

          // Match severity
          if (rule.severity !== 'all' && rule.severity !== incident.severity) continue;

          // Check if already escalated
          if (incident.escalatedAt) continue;

          // Check delay minutes
          const elapsedMinutes = (now - incident.firstDetectedAt) / (60 * 1000);
          if (elapsedMinutes >= rule.delayMinutes) {
            this.logger.warn(`Escalating incident ${incident.id} based on rule: ${rule.name}`);
            
            // Mark escalated
            await this.updateIncident(incident.id, {
              status: 'investigating',
              escalatedAt: now,
            });

            // Dispatch alert triggers
            const alertMessage = `🔥 [ESCALATION] Incident #${incident.id} (${incident.severity.toUpperCase()}) on queue [${incident.affectedQueue}] escalated by rule: ${rule.name}`;
            
            if (rule.channels.includes('dashboard')) {
              await this.dbService.saveNotification({
                id: `notif_${Math.random().toString(36).substr(2, 9)}`,
                incidentId: incident.id,
                message: alertMessage,
                severity: incident.severity,
                queueName: incident.affectedQueue,
                channel: 'dashboard',
                status: 'sent',
                timestamp: now,
              });
            }

            if (rule.channels.includes('email') || rule.channels.includes('slack_webhook') || rule.channels.includes('discord_webhook')) {
              await this.notificationsService.sendIncidentAlert(incident, true);
            }
          }
        }
      }
    } catch (e) {
      this.logger.error('Failed to run escalation rules check:', e);
    }
  }

  private async getIncidentByFingerprint(fingerprint: string, projectId?: string): Promise<Incident | undefined> {
    const list = await this.dbService.getIncidents(projectId);
    return list.find((inc) => inc.fingerprint === fingerprint);
  }

  async triggerOrUpdateIncident(
    projectId: string,
    fingerprint: string,
    data: Omit<Incident, 'id' | 'firstDetectedAt' | 'lastUpdatedAt' | 'status'>
  ) {
    const existing = await this.getIncidentByFingerprint(fingerprint, projectId);
    if (existing) {
      if (existing.status === 'open' || existing.status === 'acknowledged' || existing.status === 'investigating') {
        // Only write to Redis if something meaningful has actually changed
        const summaryChanged = existing.summary !== data.summary;
        const evidenceChanged = existing.evidence !== data.evidence;
        const severityChanged = existing.severity !== data.severity;
        const stale = (Date.now() - existing.lastUpdatedAt) > 30_000; // force refresh every 30s

        if (summaryChanged || evidenceChanged || severityChanged || stale) {
          await this.updateIncident(existing.id, {
            summary: data.summary,
            evidence: data.evidence,
            severity: data.severity,
          }, projectId);
        }
        return existing;
      }
    }
    
    return this.createIncident({
      ...data,
      fingerprint,
      status: 'open'
    }, projectId);
  }

  async resolveIncidentByFingerprint(fingerprint: string, projectId?: string) {
    const existing = await this.getIncidentByFingerprint(fingerprint, projectId);
    if (existing && (existing.status === 'open' || existing.status === 'acknowledged' || existing.status === 'investigating')) {
      await this.resolveIncident(existing.id, 'Automated resolution: telemetry metrics returned below target SLA thresholds.', projectId);
    }
  }

}
