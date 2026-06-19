import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Incident, QueueName, IncidentComment, IncidentRunbook, RunbookStepStatus } from '@queuewatch/shared';
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
    
    try {
      const timeline = await this.buildTimeline(newIncident, projectId || 'proj_demo');
      await this.dbService.saveIncidentTimeline(newIncident.id, timeline, projectId || 'proj_demo');
    } catch (err) {
      this.logger.error(`Failed to generate initial timeline for incident ${newIncident.id}: ${err.message}`);
    }

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

    try {
      const timeline = await this.buildTimeline(updated, projectId || 'proj_demo');
      await this.dbService.saveIncidentTimeline(id, timeline, projectId || 'proj_demo');
    } catch (err) {
      this.logger.error(`Failed to update timeline snapshot for incident ${id}: ${err.message}`);
    }

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

  async resolveIncident(
    id: string,
    summary: string,
    projectId?: string,
    feedback?: { whatHappened: string; whatFixedIt: string; differentlyNextTime: string; }
  ): Promise<Incident> {
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
      const resolutionTimeMin = Math.round((now - incident.firstDetectedAt) / 60000);

      // Compute blast radius downstream
      const graph = await this.dbService.getDependencyGraph(projectId);
      const affectedQueue = incident.affectedQueue;
      const visited = new Set<string>();
      const queue = [affectedQueue];
      const impactedServices: string[] = [];
      const businessImpacts: string[] = [];

      const allServices = await this.dbService.getServices(projectId);
      const directConsumer = allServices.find(s => s.queues && s.queues.includes(affectedQueue));
      if (directConsumer) {
        if (directConsumer.businessCapability) {
          businessImpacts.push(`${directConsumer.businessCapability} degraded`);
        } else {
          businessImpacts.push(`${directConsumer.name} affected`);
        }
      }

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);
        
        if (graph && graph.edges) {
          const downstreams = graph.edges
            .filter(e => e.from === current)
            .map(e => e.to);
          for (const down of downstreams) {
            if (!visited.has(down)) {
              queue.push(down);
              if (down.startsWith('svc_')) {
                const serviceDetails = allServices.find(s => s.id === down);
                if (serviceDetails) {
                  impactedServices.push(serviceDetails.name);
                  if (serviceDetails.businessCapability) {
                    businessImpacts.push(`${serviceDetails.businessCapability} degraded`);
                  } else {
                    businessImpacts.push(`${serviceDetails.name} affected`);
                  }
                }
              }
            }
          }
        }
      }

      const estimatedBlastRadius = visited.size >= 4 ? 'critical' : visited.size >= 2 ? 'high' : 'medium';
      
      let hypotheses: string[] = [];
      try {
        const report = await this.dbService.getInvestigation(incident.id, projectId);
        if (report && report.recommendedActions) {
          hypotheses = report.recommendedActions;
        }
      } catch {}

      // Fetch associated runbooks and compile executed steps / outcomes
      const incidentRunbooks = await this.dbService.getIncidentRunbooks(incident.id, projectId);
      const runbooksExecuted = incidentRunbooks.map(rb => rb.title);
      
      const totalSteps = incidentRunbooks.reduce((acc, rb) => acc + rb.steps.length, 0);
      const completedSteps = incidentRunbooks.reduce((acc, rb) => acc + rb.steps.filter(s => s.status === 'completed').length, 0);
      const skippedSteps = incidentRunbooks.reduce((acc, rb) => acc + rb.steps.filter(s => s.status === 'skipped').length, 0);
      const failedSteps = incidentRunbooks.reduce((acc, rb) => acc + rb.steps.filter(s => s.status === 'failed').length, 0);
      const blockedSteps = incidentRunbooks.reduce((acc, rb) => acc + rb.steps.filter(s => s.status === 'blocked').length, 0);
      
      let finalOutcome = 'Resolved successfully';
      if (totalSteps > 0) {
        finalOutcome = `Resolved with runbook execution progress: ${completedSteps + skippedSteps}/${totalSteps} steps completed/skipped.`;
        if (failedSteps > 0) {
          finalOutcome += ` (${failedSteps} steps failed)`;
        }
        if (blockedSteps > 0) {
          finalOutcome += ` (${blockedSteps} steps blocked)`;
        }
      }

      await this.dbService.saveKnowledgeEntry({
        id: `know_${Math.random().toString(36).substr(2, 9)}`,
        title: `Resolution: ${incident.title}`,
        incidentId: incident.id,
        pattern: incident.title,
        rootCause: incident.suspectedRootCause || 'Unverified thread resource exception.',
        resolution: summary || 'Manual service restart.',
        preventionRecommendation: incident.recommendation || 'No custom recommendation.',
        createdAt: now,
        evidence: incident.evidence,
        hypotheses,
        resolutionTimeMin,
        blastRadius: Array.from(new Set(impactedServices)),
        reliabilityImpact: `Blast Radius: ${estimatedBlastRadius.toUpperCase()}. Business Impact: ${businessImpacts.join(', ')}`,
        runbooksExecuted,
        finalOutcome,
        recoveryTime: resolutionTimeMin,
        lessonsLearned: feedback || undefined
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

  async getSuggestedRunbooksForIncident(incidentId: string, projectId?: string): Promise<IncidentRunbook[]> {
    const incident = await this.dbService.getIncident(incidentId, projectId);
    if (!incident) throw new Error(`Incident ${incidentId} not found`);

    const existing = await this.dbService.getIncidentRunbooks(incidentId, projectId);
    if (existing && existing.length > 0) {
      return existing;
    }

    const suggested: IncidentRunbook[] = [];
    const textToScan = `${incident.title} ${incident.summary} ${incident.suspectedRootCause} ${incident.affectedQueue}`.toLowerCase();

    // Check deployment correlation
    const correlation = await this.getDeploymentCorrelation(incident, projectId || 'proj_demo');

    // 1. Database Pool Exhaustion
    if (/\b(pool|connection|postgres|database|lock|timeout|contention)\b/.test(textToScan)) {
      suggested.push({
        id: 'run_db_pool_exhaustion',
        incidentId,
        title: 'Database Pool Exhaustion Runbook',
        difficulty: 'high',
        recoveryTimeMin: 10,
        riskLevel: 'high',
        steps: [
          { label: 'Check active database connections count.', status: 'pending', updatedAt: Date.now() },
          { label: 'Inspect connection pool utilization limits.', status: 'pending', updatedAt: Date.now() },
          { label: 'Review recent deployment commits and configurations.', status: 'pending', updatedAt: Date.now() },
          { label: 'Scale worker replicas to distribute database load.', status: 'pending', updatedAt: Date.now() },
          { label: 'Monitor recovery metrics and database queue latencies.', status: 'pending', updatedAt: Date.now() }
        ]
      });
    }

    // 2. Deployment Regression
    if (correlation || /\b(deploy|version|commit|regression|release)\b/.test(textToScan)) {
      suggested.push({
        id: 'run_deployment_regression',
        incidentId,
        title: 'Deployment Regression Runbook',
        difficulty: 'low',
        recoveryTimeMin: 5,
        riskLevel: 'medium',
        steps: [
          { label: 'Compare deployment diff between latest and previous tags.', status: 'pending', updatedAt: Date.now() },
          { label: 'Review active feature flags state for the service.', status: 'pending', updatedAt: Date.now() },
          { label: 'Check environment variables and configuration drifts.', status: 'pending', updatedAt: Date.now() },
          { label: 'Rollback deployment to the previous stable release.', status: 'pending', updatedAt: Date.now() },
          { label: 'Monitor system metrics to confirm stability.', status: 'pending', updatedAt: Date.now() }
        ]
      });
    }

    // 3. Worker Saturation
    if (/\b(worker|concurrency|cpu|memory|saturation|overload|latency)\b/.test(textToScan) || suggested.length === 0) {
      suggested.push({
        id: 'run_worker_saturation',
        incidentId,
        title: 'Worker Saturation Runbook',
        difficulty: 'low',
        recoveryTimeMin: 2,
        riskLevel: 'low',
        steps: [
          { label: 'Check worker concurrency limits and pool sizes.', status: 'pending', updatedAt: Date.now() },
          { label: 'Check CPU and memory usage profiles on worker nodes.', status: 'pending', updatedAt: Date.now() },
          { label: 'Scale worker processes or container instances.', status: 'pending', updatedAt: Date.now() },
          { label: 'Monitor queue backlog depth and processing latency.', status: 'pending', updatedAt: Date.now() }
        ]
      });
    }

    // 4. DLQ Growth
    if (incident.affectedQueue === 'dead_letter_queue' || /\b(dlq|dead_letter|dead-letter|failed jobs|poison)\b/.test(textToScan)) {
      suggested.push({
        id: 'run_dlq_growth',
        incidentId,
        title: 'Dead-Letter Queue Recovery Runbook',
        difficulty: 'medium',
        recoveryTimeMin: 5,
        riskLevel: 'medium',
        steps: [
          { label: 'Inspect failed dead-lettered jobs properties.', status: 'pending', updatedAt: Date.now() },
          { label: 'Review failure error signatures and stack traces.', status: 'pending', updatedAt: Date.now() },
          { label: 'Fix the root cause bugs in worker code.', status: 'pending', updatedAt: Date.now() },
          { label: 'Replay dead-letter jobs back to the active queue.', status: 'pending', updatedAt: Date.now() }
        ]
      });
    }

    // Save them to Redis
    for (const runbook of suggested) {
      await this.dbService.saveIncidentRunbook(runbook, projectId);
    }

    return suggested;
  }

  async updateIncidentRunbookStep(
    incidentId: string,
    runbookId: string,
    stepIndex: number,
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'blocked',
    projectId?: string
  ): Promise<IncidentRunbook> {
    const runbook = await this.dbService.getIncidentRunbook(incidentId, runbookId, projectId);
    if (!runbook) throw new Error(`Runbook ${runbookId} not found for incident ${incidentId}`);

    if (stepIndex < 0 || stepIndex >= runbook.steps.length) {
      throw new Error(`Step index ${stepIndex} out of bounds`);
    }

    const oldStatus = runbook.steps[stepIndex].status;
    runbook.steps[stepIndex].status = status;
    runbook.steps[stepIndex].updatedAt = Date.now();

    await this.dbService.saveIncidentRunbook(runbook, projectId);

    // Timeline event tracking
    if (oldStatus !== status) {
      const stepLabel = runbook.steps[stepIndex].label;
      const statusLabelMap = {
        pending: 'reset to pending',
        in_progress: 'started',
        completed: 'completed successfully',
        failed: 'failed',
        skipped: 'skipped',
        blocked: 'blocked'
      };
      
      const newEvent = {
        event: 'runbook.step_progress',
        title: 'Runbook Step Update',
        desc: `Step "${stepLabel}" was ${statusLabelMap[status]} for "${runbook.title}".`,
        timestamp: Date.now(),
        metadata: { runbookId, stepIndex, status }
      };

      const currentEvents = await this.dbService.getIncidentRunbookEvents(incidentId, projectId);
      currentEvents.push(newEvent);
      await this.dbService.saveIncidentRunbookEvents(incidentId, currentEvents, projectId);

      // Force recalculation and persistence of incident timeline snapshot
      const incident = await this.dbService.getIncident(incidentId, projectId);
      if (incident) {
        const fullTimeline = await this.buildTimeline(incident, projectId || 'proj_demo');
        await this.dbService.saveIncidentTimeline(incidentId, fullTimeline, projectId || 'proj_demo');
      }

      // Broadcast changes
      this.wsGateway.broadcast('incident.runbook_updated', { incidentId, runbookId, stepIndex, status, projectId });
    }

    return runbook;
  }

  async getDeploymentCorrelation(incident: Incident, projectId: string) {
    const allDeps = await this.dbService.getDeploymentEvents(projectId);
    const incidentTime = incident.firstDetectedAt;

    // We check deployments that occurred up to 24 hours before the incident
    const windowStart = incidentTime - 24 * 60 * 60 * 1000;
    const candidateDeps = allDeps
      .filter((dep) => dep.deployedAt >= windowStart && dep.deployedAt <= incidentTime)
      .sort((a, b) => b.deployedAt - a.deployedAt); // most recent first

    if (candidateDeps.length === 0) return null;

    // Find the most relevant candidate. We prefer candidates that match the affectedQueue name
    const matchingDep = candidateDeps.find(
      (d) => d.service === incident.affectedQueue || incident.title.toLowerCase().includes(d.service)
    ) || candidateDeps[0];

    const delayMs = incidentTime - matchingDep.deployedAt;
    const delayMin = Math.round(delayMs / 60000);

    let confidence: 'strong' | 'possible' | 'context' = 'context';
    let confidenceLabel = 'Context only';
    let label = 'Historical context';
    let explanation = `Deployment occurred ${delayMin} minutes before incident.`;

    if (delayMs <= 30 * 60 * 1000) {
      confidence = 'strong';
      confidenceLabel = 'Strong correlation';
      label = 'Likely regression';
      explanation = `Deployment occurred ${delayMin} minutes before first failure.`;
    } else if (delayMs <= 2 * 60 * 60 * 1000) {
      confidence = 'possible';
      confidenceLabel = 'Possible correlation';
      label = 'Weak correlation';
      explanation = `Deployment occurred ${delayMin} minutes before incident.`;
    }

    return {
      service: matchingDep.service,
      version: matchingDep.version,
      commitSha: matchingDep.commitSha,
      branch: matchingDep.branch,
      deployedBy: matchingDep.deployedBy,
      deployedAt: matchingDep.deployedAt,
      confidence,
      confidenceLabel,
      label,
      explanation,
    };
  }

  async buildTimeline(incident: Incident, projectId: string): Promise<any[]> {
    const firstTime = incident.firstDetectedAt;
    const lastTime = incident.resolvedAt ?? incident.lastUpdatedAt ?? Date.now();
    const timeline: any[] = [];

    // 1. Get deployment correlation
    const correlation = await this.getDeploymentCorrelation(incident, projectId);
    if (correlation) {
      timeline.push({
        event: 'deployment',
        title: `Service Deployed (${correlation.label})`,
        desc: `${correlation.explanation} (Version: ${correlation.version}, Commit: ${correlation.commitSha}${correlation.branch ? `, Branch: ${correlation.branch}` : ''}) by ${correlation.deployedBy}.`,
        timestamp: correlation.deployedAt,
        metadata: { correlation }
      });
    }

    // 2. Fetch telemetry events in range [firstTime - 30m, lastTime]
    const allTelemetry = await this.dbService.getTelemetry(1000, projectId);
    const relatedTelemetry = allTelemetry.filter(
      (e) => e.queueName === incident.affectedQueue && e.timestamp >= firstTime - 30 * 60 * 1000 && e.timestamp <= lastTime
    );

    // Identify first error
    const firstFailed = [...relatedTelemetry].reverse().find((e) => e.type === 'job.failed');
    if (firstFailed) {
      timeline.push({
        event: 'first.error',
        title: 'First Failure Detected',
        desc: `Earliest exception recorded on queue [${incident.affectedQueue}]: "${firstFailed.errorMessage || 'Unknown execution failure'}" (Job ID: ${firstFailed.jobId})`,
        timestamp: firstFailed.timestamp,
      });
    }

    // 3. Incident Anomaly Detected / Failure Spike
    timeline.push({
      event: 'failures.spiked',
      title: 'Failure Rate Spike & Incident Opened',
      desc: `SLA violation rules triggered active incident #${incident.id}. Details: "${incident.summary}"`,
      timestamp: firstTime,
    });

    // 4. Alert notifications dispatched
    const notifications = await this.dbService.getNotifications(200, projectId);
    const relatedNotifs = notifications.filter(
      (n) => n.incidentId === incident.id && n.timestamp >= firstTime && n.timestamp <= firstTime + 10 * 60 * 1000
    );

    for (const notif of relatedNotifs) {
      timeline.push({
        event: 'alert.sent',
        title: `Alert Dispatched (${notif.channel})`,
        desc: `Notification successfully routed: "${notif.message}"`,
        timestamp: notif.timestamp,
      });
    }

    // 5. Incident Acknowledged
    if (incident.acknowledgedAt) {
      timeline.push({
        event: 'incident.acknowledged',
        title: 'Incident Acknowledged',
        desc: `Incident response owner assigned: ${incident.responseOwner || 'SRE Operator'}. Active diagnostics started.`,
        timestamp: incident.acknowledgedAt,
      });
    }

    // 6. AI SRE Investigation
    const report = await this.dbService.getInvestigation(incident.id, projectId);
    if (report) {
      timeline.push({
        event: 'investigation.started',
        title: 'AI SRE Diagnostics Active',
        desc: 'SRE AI Copilot started E2E telemetry inspection and code correlation.',
        timestamp: report.timestamp - 1000,
      });
      timeline.push({
        event: 'investigation.completed',
        title: 'AI Diagnostics Completed',
        desc: `Root cause identified with confidence score ${report.confidenceScore}%. Suspected cause: "${report.rootCause}"`,
        timestamp: report.timestamp,
      });
    }

    // 7. Incident Resolved
    if (incident.status === 'resolved') {
      timeline.push({
        event: 'incident.resolved',
        title: 'Incident Resolved',
        desc: `Incident resolved. Summary: "${incident.resolutionSummary || 'Active queues returned to healthy state.'}"`,
        timestamp: incident.resolvedAt || incident.lastUpdatedAt,
      });
    }

    // 8. Runbook Step Progress Events
    const runbookEvents = await this.dbService.getIncidentRunbookEvents(incident.id, projectId);
    timeline.push(...runbookEvents);

    // Sort chronologically
    return timeline.sort((a, b) => a.timestamp - b.timestamp);
  }

  async getIncidentTimeline(id: string, projectId: string): Promise<any[]> {
    const incident = await this.dbService.getIncident(id, projectId);
    if (!incident) throw new Error(`Incident ${id} not found`);

    if (incident.status === 'resolved') {
      const persisted = await this.dbService.getIncidentTimeline(id, projectId);
      if (persisted && persisted.length > 0) return persisted.sort((a, b) => a.timestamp - b.timestamp);
    }

    // Rebuild dynamically
    const timeline = await this.buildTimeline(incident, projectId);
    await this.dbService.saveIncidentTimeline(id, timeline, projectId);
    return timeline;
  }

  async getSimilarIncidents(incidentId: string, projectId?: string): Promise<any[]> {
    const incident = await this.dbService.getIncident(incidentId, projectId);
    if (!incident) throw new Error(`Incident ${incidentId} not found`);

    const entries = await this.dbService.getKnowledgeEntries(projectId);
    const similar: any[] = [];

    // Current incident parameters
    const queue1 = incident.affectedQueue;
    const services = await this.dbService.getServices(projectId);
    const svc1 = services.find(s => s.queues && s.queues.includes(queue1))?.name || '';
    const sev1 = incident.severity || 'high';

    // Current incident blast radius using BFS
    const graph = await this.dbService.getDependencyGraph(projectId);
    const visited = new Set<string>();
    const queueList = [queue1];
    const currentBlastRadius: string[] = [];
    while (queueList.length > 0) {
      const current = queueList.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      if (graph && graph.edges) {
        const downstreams = graph.edges
          .filter(e => e.from === current)
          .map(e => e.to);
        for (const down of downstreams) {
          if (!visited.has(down)) {
            queueList.push(down);
            if (down.startsWith('svc_')) {
              const svcDetails = services.find(s => s.id === down);
              if (svcDetails) {
                currentBlastRadius.push(svcDetails.name);
              }
            }
          }
        }
      }
    }

    // Current incident causal graph structure
    let currentNodes: string[] = [];
    try {
      const report = await this.dbService.getInvestigation(incident.id, projectId);
      if (report && report.investigationGraph && report.investigationGraph.nodes) {
        currentNodes = report.investigationGraph.nodes.map(n => n.type);
      }
    } catch {}
    if (currentNodes.length === 0) {
      const timeline = await this.buildTimeline(incident, projectId);
      currentNodes = timeline.map(n => n.type || 'log');
    }

    // Stopwords and text utility for Jaccard
    const stopwords = new Set(['have', 'we', 'seen', 'this', 'before', 'what', 'solved', 'it', 'is', 'a', 'the', 'an', 'and', 'or', 'for', 'on', 'in', 'at', 'to', 'of', 'with', 'issue', 'issues', 'problem', 'problems']);
    const getTokens = (text: string): string[] => {
      const words = text.toLowerCase().match(/\b\w+\b/g) || [];
      return words.filter(w => !stopwords.has(w));
    };

    const computeJaccard = (tokens1: string[], tokens2: string[]): number => {
      const set1 = new Set(tokens1);
      const set2 = new Set(tokens2);
      if (set1.size === 0 && set2.size === 0) return 1;
      if (set1.size === 0 || set2.size === 0) return 0;
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      return intersection.size / union.size;
    };

    const severityPointsMap: Record<string, number> = { critical: 40, high: 25, medium: 15, low: 5 };

    const projectQueues = await this.dbService.getProjectQueues(projectId || 'proj_demo');

    for (const entry of entries) {
      if (entry.incidentId === incidentId) continue; // Skip itself

      // Load historical incident if available
      let histIncident: any = null;
      try {
        histIncident = await this.dbService.getIncident(entry.incidentId, projectId);
      } catch {}

      // 1. Queue Name match (20 pts)
      let queue2 = '';
      if (histIncident) {
        queue2 = histIncident.affectedQueue;
      } else {
        const textToScan = `${entry.title} ${entry.pattern} ${entry.evidence || ''} ${entry.reliabilityImpact || ''}`.toLowerCase();
        for (const q of projectQueues) {
          if (textToScan.includes(q.toLowerCase())) {
            queue2 = q;
            break;
          }
        }
      }
      const queueScore = (queue1 && queue2 && queue1 === queue2) ? 20 : 0;

      // 2. Service Name match (15 pts)
      let svc2 = '';
      if (histIncident) {
        svc2 = services.find(s => s.queues && s.queues.includes(queue2))?.name || '';
      } else {
        for (const s of services) {
          const textToScan = `${entry.title} ${entry.pattern} ${entry.reliabilityImpact || ''} ${entry.resolution}`.toLowerCase();
          if (textToScan.includes(s.name.toLowerCase()) || textToScan.includes(s.id.toLowerCase())) {
            svc2 = s.name;
            break;
          }
        }
        if (!svc2 && queue2) {
          svc2 = services.find(s => s.queues && s.queues.includes(queue2))?.name || '';
        }
      }
      const serviceScore = (svc1 && svc2 && svc1 === svc2) ? 15 : 0;

      // 3. Error Messages / Logs match (20 pts)
      const errorTokens1 = getTokens(`${incident.evidence} ${incident.relatedErrors?.join(' ') || ''}`);
      const errorTokens2 = getTokens(`${entry.evidence || ''} ${entry.pattern} ${entry.rootCause}`);
      const errorScore = Math.round(computeJaccard(errorTokens1, errorTokens2) * 20);

      // 4. Incident Severity match (10 pts)
      let sev2 = 'high';
      if (histIncident) {
        sev2 = histIncident.severity || 'high';
      } else {
        const textToScan = `${entry.title} ${entry.reliabilityImpact || ''}`.toLowerCase();
        if (textToScan.includes('critical')) sev2 = 'critical';
        else if (textToScan.includes('high')) sev2 = 'high';
        else if (textToScan.includes('medium')) sev2 = 'medium';
        else if (textToScan.includes('low')) sev2 = 'low';
      }
      let severityScore = 0;
      if (sev1 === sev2) {
        severityScore = 10;
      } else {
        const levels = ['low', 'medium', 'high', 'critical'];
        const idx1 = levels.indexOf(sev1);
        const idx2 = levels.indexOf(sev2);
        if (idx1 !== -1 && idx2 !== -1 && Math.abs(idx1 - idx2) === 1) {
          severityScore = 5;
        }
      }

      // 5. Blast Radius match (15 pts)
      const blast2 = entry.blastRadius || [];
      let blastScore = 0;
      if (currentBlastRadius.length === 0 && blast2.length === 0) {
        blastScore = 15;
      } else {
        blastScore = Math.round(computeJaccard(currentBlastRadius, blast2) * 15);
      }

      // 6. Reliability Score Degradation match (10 pts)
      const deg1 = severityPointsMap[sev1] || 25;
      const deg2 = severityPointsMap[sev2] || 25;
      const degDiff = Math.abs(deg1 - deg2);
      const degradationScore = degDiff === 0 ? 10 : degDiff <= 15 ? 5 : 0;

      // 7. Causal Graph Structure match (10 pts)
      let histNodes: string[] = [];
      try {
        const histReport = await this.dbService.getInvestigation(entry.incidentId, projectId);
        if (histReport && histReport.investigationGraph && histReport.investigationGraph.nodes) {
          histNodes = histReport.investigationGraph.nodes.map(n => n.type);
        }
      } catch {}
      if (histNodes.length === 0) {
        if (entry.evidence) histNodes.push('log');
        if (entry.hypotheses && entry.hypotheses.length > 0) histNodes.push('incident');
        if (entry.runbooksExecuted && entry.runbooksExecuted.length > 0) {
          histNodes.push('runbook');
          histNodes.push('recovery');
        }
        if (entry.blastRadius && entry.blastRadius.length > 0) histNodes.push('impact');
      }
      const causalScore = Math.round(computeJaccard(currentNodes, histNodes) * 10);

      // Total Score
      const totalScore = Math.min(100, queueScore + serviceScore + errorScore + severityScore + blastScore + degradationScore + causalScore);

      if (totalScore >= 15) {
        similar.push({
          knowledgeEntryId: entry.id,
          incidentId: entry.incidentId,
          title: entry.title,
          similarityScore: totalScore,
          rootCause: entry.rootCause,
          resolution: entry.resolution,
          recoveryTime: entry.recoveryTime || entry.resolutionTimeMin || 0,
          runbooksExecuted: entry.runbooksExecuted || [],
          finalOutcome: entry.finalOutcome || 'Resolved',
          lessonsLearned: entry.lessonsLearned
        });
      }
    }

    return similar.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 5);
  }
}
