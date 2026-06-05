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
    this.logger.log(`[Incident] Incident updated: ${updated.id} (${updated.status})`);
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

  async evaluateSystemState(metricsList: any[], workerHealthList: any[], dlqCount: number) {
    // Keep baseline metrics checking
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

    // Run V3 escalation rule evaluation
    await this.checkEscalations();
  }

  async checkEscalations() {
    try {
      const rules = await this.dbService.getEscalationRules();
      const openIncidents = (await this.dbService.getIncidents()).filter(
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

  private async getOpenIncidentByTitle(title: string, projectId?: string): Promise<Incident | undefined> {
    const list = await this.dbService.getIncidents(projectId);
    return list.find((inc) => inc.title === title && inc.status === 'open');
  }
}
