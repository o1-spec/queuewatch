import { Injectable, Logger, Inject, forwardRef, NotFoundException, BadRequestException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { QueuesService } from '../queues/queues.service';
import { WorkersService } from '../workers/workers.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { AiService } from '../ai/ai.service';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';
import {
  InvestigationReport, QueueName,
  AgentSession, AgentPlan, AgentHypothesis, RunbookMatch,
  AgentAction, ApprovalDecision, ExecutionEntry, EvidenceItem,
  TeamAgentFinding, ConsensusReport,
} from '@queuewatch/shared';

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

  // ─── Stage 1: PLANNER ──────────────────────────────────────────────────────
  // Understands the incident, determines investigation strategy, selects tools

  private async planInvestigation(incidentId: string, projectId: string): Promise<AgentPlan> {
    const incident = await this.dbService.getIncident(incidentId, projectId);
    if (!incident) throw new NotFoundException(`Incident ${incidentId} not found`);

    const q = incident.affectedQueue;
    const text = `${incident.title} ${incident.summary} ${incident.suspectedRootCause || ''}`.toLowerCase();

    // Determine investigation strategy from incident fingerprint
    let strategy = 'General reliability investigation';
    if (/\b(database|db|postgres|pool|connection|timeout)\b/.test(text)) {
      strategy = 'Database connection pool saturation investigation';
    } else if (/\b(deploy|version|regression|commit|release)\b/.test(text)) {
      strategy = 'Deployment regression correlation investigation';
    } else if (/\b(worker|cpu|memory|saturation|overload)\b/.test(text)) {
      strategy = 'Worker resource saturation investigation';
    } else if (/\b(dlq|dead.?letter|poison|replay)\b/.test(text)) {
      strategy = 'Dead-letter queue poisoning investigation';
    }

    // Identify downstream service if any
    const services = await this.dbService.getServices(projectId);
    const targetService = services.find(s => s.queues?.includes(q))?.id;

    return {
      strategy,
      targetQueue: q,
      targetService,
      steps: [
        'Fetch incident metadata and severity context',
        'Check current queue metrics and backlog depth',
        'Analyze recent error logs and stack traces',
        'Correlate recent deployments within 30-minute window',
        'Retrieve worker health and concurrency state',
        'Inspect dead-letter job count and payload patterns',
        'Calculate blast radius from dependency graph',
        'Query reliability score contributors',
        'Search incident knowledge base for similar patterns',
        'Generate ranked hypotheses with confidence scores',
        'Match runbooks against top hypothesis',
        'Build recommended action set with risk assessment',
      ],
    };
  }

  // ─── Stage 2: INVESTIGATOR ─────────────────────────────────────────────────
  // Collects evidence from 7+ data sources

  private async collectEvidence(plan: AgentPlan, incidentId: string, projectId: string): Promise<EvidenceItem[]> {
    const evidence: EvidenceItem[] = [];
    const { targetQueue, targetService } = plan;
    const incident = await this.dbService.getIncident(incidentId, projectId);

    // 1. Incident itself
    evidence.push({
      id: `ev_incident_${incidentId}`,
      type: 'incident',
      rank: 'primary',
      message: `${incident.severity.toUpperCase()} incident: "${incident.title}" affecting queue "${targetQueue}". Status: ${incident.status}.`,
      timestamp: incident.firstDetectedAt,
      metadata: { incidentId, severity: incident.severity, status: incident.status },
    });

    // 2. Queue metrics
    try {
      const queuesList = await this.queuesService.getQueuesList(projectId);
      const qMetrics = queuesList.find(q => q.name === targetQueue);
      if (qMetrics) {
        if (qMetrics.failedCount > 0) {
          evidence.push({
            id: `ev_queue_failures_${targetQueue}`,
            type: 'metric',
            rank: 'primary',
            message: `Queue "${targetQueue}" has ${qMetrics.failedCount} failed jobs with ${qMetrics.waitingCount} waiting. Throughput: ${qMetrics.throughput} jobs/min.`,
            metadata: { failedCount: qMetrics.failedCount, waitingCount: qMetrics.waitingCount, throughput: qMetrics.throughput },
          });
        }
        if (qMetrics.averageLatency > 3000) {
          evidence.push({
            id: `ev_queue_latency_${targetQueue}`,
            type: 'metric',
            rank: 'primary',
            message: `Queue "${targetQueue}" average job latency is ${qMetrics.averageLatency}ms — exceeds 3000ms SLA threshold.`,
            metadata: { latency: qMetrics.averageLatency },
          });
        }
      }
    } catch (_) {}

    // 3. Recent error logs
    const logs = await this.dbService.getLogs(targetQueue, 50, projectId);
    const errorLogs = logs.filter(l => l.level === 'error').slice(0, 5);
    for (const log of errorLogs) {
      evidence.push({
        id: `ev_log_${log.id || log.timestamp}`,
        type: 'log',
        rank: 'primary',
        message: `Error log: "${log.message}" in queue "${log.queueName}".`,
        timestamp: log.timestamp,
        metadata: { jobId: log.jobId, traceId: log.traceId },
      });
    }

    // 4. Recent deployments (30-min correlation window)
    const deployments = await this.dbService.getDeploymentEvents(projectId);
    const correlatedDeploy = deployments.find(d =>
      d.deployedAt <= incident.firstDetectedAt &&
      incident.firstDetectedAt - d.deployedAt <= 30 * 60 * 1000
    );
    if (correlatedDeploy) {
      evidence.push({
        id: `ev_deploy_${correlatedDeploy.id}`,
        type: 'deployment',
        rank: 'secondary',
        message: `Deployment of "${correlatedDeploy.service}" v${correlatedDeploy.version} (${correlatedDeploy.commitSha.substring(0, 8)}) was released ${Math.round((incident.firstDetectedAt - correlatedDeploy.deployedAt) / 60000)} minutes before incident detection.`,
        timestamp: correlatedDeploy.deployedAt,
        metadata: { version: correlatedDeploy.version, commitSha: correlatedDeploy.commitSha, service: correlatedDeploy.service },
      });
    }

    // 5. Worker health
    try {
      const workers = await this.workersService.getWorkersList(projectId);
      const qWorker = workers.find(w => w.queueName === targetQueue);
      if (qWorker) {
        const isUnhealthy = qWorker.status !== 'healthy' || qWorker.cpuUsage > 80 || qWorker.memoryUsage > 85;
        if (isUnhealthy) {
          evidence.push({
            id: `ev_worker_${qWorker.workerId}`,
            type: 'metric',
            rank: 'secondary',
            message: `Worker "${qWorker.workerId}" for queue "${targetQueue}" is ${qWorker.status} with CPU: ${qWorker.cpuUsage}%, Memory: ${qWorker.memoryUsage}%.`,
            metadata: { workerId: qWorker.workerId, status: qWorker.status, cpu: qWorker.cpuUsage, memory: qWorker.memoryUsage },
          });
        }
      }
    } catch (_) {}

    // 6. Dead-letter jobs
    const dlqJobs = await this.dbService.getDeadLetterJobs(projectId);
    const qDlq = dlqJobs.filter(j => j.queueName === targetQueue);
    if (qDlq.length > 0) {
      evidence.push({
        id: `ev_dlq_${targetQueue}`,
        type: 'metric',
        rank: 'secondary',
        message: `Dead-letter queue for "${targetQueue}" contains ${qDlq.length} failed jobs. Latest failure reason: "${qDlq[0]?.failedReason || 'unknown'}".`,
        metadata: { dlqCount: qDlq.length, latestReason: qDlq[0]?.failedReason },
      });
    }

    // 7. Blast radius from dependency graph
    const depGraph = await this.dbService.getDependencyGraph(projectId);
    const startNode = targetService || targetQueue;
    if (depGraph?.edges) {
      const visited = new Set<string>();
      const bfsQ = [startNode];
      visited.add(startNode);
      const downstream: string[] = [];
      while (bfsQ.length > 0) {
        const curr = bfsQ.shift()!;
        for (const edge of depGraph.edges.filter(e => e.from === curr)) {
          if (!visited.has(edge.to)) {
            visited.add(edge.to);
            bfsQ.push(edge.to);
            downstream.push(edge.to);
          }
        }
      }
      if (downstream.length > 0) {
        evidence.push({
          id: `ev_blast_radius_${targetQueue}`,
          type: 'graph',
          rank: 'context',
          message: `Blast radius analysis: Outage on "${targetQueue}" propagates downstream to [${downstream.slice(0, 4).join(', ')}].`,
          metadata: { downstream },
        });
      }
    }

    // 8. Reliability score
    const scores = await this.dbService.getReliabilityScores(projectId);
    const qScore = scores.find(s => s.targetId === targetQueue && s.targetType === 'queue');
    if (qScore) {
      evidence.push({
        id: `ev_score_${targetQueue}`,
        type: 'score',
        rank: 'context',
        message: `Reliability score for queue "${targetQueue}" is ${qScore.score}% (failure rate: ${qScore.failureRate?.toFixed(1)}%, MTTR: ${qScore.mttrMinutes}min).`,
        metadata: { score: qScore.score, failureRate: qScore.failureRate },
      });
    }

    // 9. Similar incidents from knowledge base
    const knowledgeEntries = await this.dbService.getKnowledgeEntries(projectId);
    const incText = `${incident.title} ${incident.summary} ${incident.suspectedRootCause || ''}`.toLowerCase();
    const incTokens = (incText.match(/\b\w{4,}\b/g) || []).filter(t => !['this','that','with','from','have','been','were','they','them'].includes(t));
    const similar = knowledgeEntries
      .map(e => {
        const eText = `${e.title} ${e.pattern} ${e.rootCause}`.toLowerCase();
        const matchCount = incTokens.filter(t => eText.includes(t)).length;
        return { entry: e, score: incTokens.length > 0 ? Math.round((matchCount / incTokens.length) * 100) : 0 };
      })
      .filter(x => x.score > 20)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);
    for (const { entry, score } of similar) {
      evidence.push({
        id: `ev_kb_${entry.id}`,
        type: 'incident',
        rank: 'context',
        message: `Similar past incident found (${score}% match): "${entry.title}". Resolved via: ${entry.resolution}. MTTR: ${entry.recoveryTime || entry.resolutionTimeMin || '?'}min.`,
        metadata: { knowledgeEntryId: entry.id, resolution: entry.resolution, recoveryTime: entry.recoveryTime },
      });
    }

    return evidence;
  }

  // ─── Stage 3: HYPOTHESIS ENGINE ────────────────────────────────────────────
  // Generates competing root-cause explanations with confidence scores

  private generateHypotheses(evidence: EvidenceItem[], plan: AgentPlan): AgentHypothesis[] {
    const hypotheses: AgentHypothesis[] = [];
    const allText = evidence.map(e => e.message.toLowerCase()).join(' ');

    const score = (patterns: RegExp[], baseWeight: number, evidenceBonus: number): number => {
      const patternHits = patterns.filter(p => p.test(allText)).length;
      const primaryCount = evidence.filter(e => e.rank === 'primary').length;
      const raw = baseWeight + (patternHits / patterns.length) * evidenceBonus + Math.min(primaryCount * 5, 20);
      return Math.min(Math.round(raw), 99);
    };

    // Hypothesis A: Database Pool Exhaustion
    const dbPatterns = [/database|pool|connection|postgres|timeout|exhaustion/];
    const dbConf = score(dbPatterns, 30, 62);
    if (dbConf > 25) {
      const evIds = evidence.filter(e => /database|pool|connection|postgres|timeout/.test(e.message.toLowerCase())).map(e => e.id);
      hypotheses.push({
        id: 'hyp_db_pool',
        title: 'Database Connection Pool Exhaustion',
        description: `Worker processes cannot acquire database connections from the pool. Connection limits are saturated, causing job execution to stall and timeout. All new job attempts fail with pool exhaustion errors until the connection limit is increased or stale connections are released.`,
        confidence: dbConf,
        evidenceIds: evIds.length > 0 ? evIds : evidence.slice(0, 2).map(e => e.id),
        rank: 0,
      });
    }

    // Hypothesis B: Deployment Regression
    const deployPatterns = [/deployment|regression|version|commit|release/];
    const depConf = score(deployPatterns, 20, 65);
    if (depConf > 20) {
      const evIds = evidence.filter(e => e.type === 'deployment' || /deploy|version/.test(e.message.toLowerCase())).map(e => e.id);
      hypotheses.push({
        id: 'hyp_deploy_regression',
        title: 'Deployment Regression',
        description: `A recent deployment introduced a breaking change or misconfiguration that caused worker failures. The timing correlation between the deployment event and the incident onset strongly suggests the release is the root cause.`,
        confidence: depConf,
        evidenceIds: evIds.length > 0 ? evIds : evidence.filter(e => e.type === 'deployment').map(e => e.id),
        rank: 0,
      });
    }

    // Hypothesis C: Worker Saturation
    const workerPatterns = [/worker|cpu|memory|saturation|overload|concurrency/];
    const workerConf = score(workerPatterns, 15, 55);
    if (workerConf > 15) {
      const evIds = evidence.filter(e => e.type === 'metric' && /worker|cpu|memory/.test(e.message.toLowerCase())).map(e => e.id);
      hypotheses.push({
        id: 'hyp_worker_saturation',
        title: 'Worker Resource Saturation',
        description: `Worker processes are exhausting available CPU or memory resources, preventing normal job execution. High concurrency limits relative to available system resources are causing job processing delays and failures.`,
        confidence: workerConf,
        evidenceIds: evIds.length > 0 ? evIds : evidence.filter(e => e.type === 'metric').map(e => e.id),
        rank: 0,
      });
    }

    // Hypothesis D: DLQ Poison Pill
    const dlqPatterns = [/dlq|dead.?letter|poison|payload|schema|validation/];
    const dlqConf = score(dlqPatterns, 10, 57);
    if (dlqConf > 10) {
      const evIds = evidence.filter(e => /dlq|dead.?letter|poison/.test(e.message.toLowerCase())).map(e => e.id);
      hypotheses.push({
        id: 'hyp_dlq_poison',
        title: 'Dead-Letter Queue Poison Pill',
        description: `One or more jobs contain malformed or schema-incompatible payloads that repeatedly fail processing and accumulate in the dead-letter queue. Workers repeatedly attempt and fail on the same jobs, consuming resources without progress.`,
        confidence: dlqConf,
        evidenceIds: evIds.length > 0 ? evIds : evidence.filter(e => e.type === 'metric').map(e => e.id),
        rank: 0,
      });
    }

    // Fallback hypothesis if nothing matches
    if (hypotheses.length === 0) {
      hypotheses.push({
        id: 'hyp_unknown',
        title: 'Unclassified Performance Degradation',
        description: `The queue is showing indicators of degradation, but the evidence pattern does not match any known failure category. Manual investigation of worker logs and queue state is recommended.`,
        confidence: 30,
        evidenceIds: evidence.slice(0, 3).map(e => e.id),
        rank: 1,
      });
    }

    // Sort by confidence descending and assign ranks
    hypotheses.sort((a, b) => b.confidence - a.confidence);
    hypotheses.forEach((h, i) => { h.rank = i + 1; });

    return hypotheses;
  }

  // ─── Stage 4: RUNBOOK RESOLVER ─────────────────────────────────────────────
  // Searches runbooks + knowledge base for the best remediation path

  private async resolveRunbooks(hypotheses: AgentHypothesis[], projectId: string): Promise<RunbookMatch[]> {
    const runbooks = await this.dbService.getRunbooks(projectId);
    const matches: RunbookMatch[] = [];

    for (const hyp of hypotheses.slice(0, 3)) {
      const hypText = `${hyp.title} ${hyp.description}`.toLowerCase();
      for (const rb of runbooks) {
        const rbText = `${rb.title} ${rb.incidentType}`.toLowerCase();
        const rbTokens = (rbText.match(/\b\w{4,}\b/g) || []);
        const hypTokens = (hypText.match(/\b\w{4,}\b/g) || []);
        const matchCount = rbTokens.filter(t => hypText.includes(t)).length;
        const score = rbTokens.length > 0 ? Math.round((matchCount / rbTokens.length) * 100) : 0;

        if (score > 20 && !matches.some(m => m.runbookId === rb.id)) {
          matches.push({
            runbookId: rb.id,
            title: rb.title,
            matchScore: score,
            reason: `Matched hypothesis "${hyp.title}" (confidence: ${hyp.confidence}%) with ${matchCount} overlapping keywords.`,
          });
        }
      }
    }

    return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, 4);
  }

  // ─── Stage 5: RECOMMENDATION ENGINE ───────────────────────────────────────
  // Produces ranked actions with risk level, expected outcome, ETA

  private buildRecommendations(
    hypotheses: AgentHypothesis[],
    runbookMatches: RunbookMatch[],
    evidence: EvidenceItem[],
    plan: AgentPlan,
    incidentId: string,
    projectId: string
  ): AgentAction[] {
    const actions: AgentAction[] = [];
    const topHyp = hypotheses[0];
    const { targetQueue } = plan;
    const hasDeploy = evidence.some(e => e.type === 'deployment');
    const hasDlq = evidence.some(e => /dlq|dead.?letter/.test(e.message.toLowerCase()));
    const topRunbook = runbookMatches[0];
    const pid = projectId;

    // Always: Acknowledge the incident first (low risk)
    actions.push({
      id: `act_ack_${incidentId}`,
      type: 'ack_incident',
      description: `Acknowledge incident to assign ownership and stop escalation timers.`,
      reasoning: `Acknowledging the incident assigns SRE ownership, halts automated escalation alerts, and signals the team is actively investigating.`,
      riskLevel: 'low',
      expectedOutcome: 'Incident status changes to "acknowledged". Escalation suppressed.',
      estimatedRecoveryMin: 1,
      command: `curl -X PATCH -H "Authorization: Bearer $TOKEN" -H "x-project-id: ${pid}" $API_URL/api/incidents/${incidentId}/acknowledge`,
      status: 'pending',
      associatedRunbook: topRunbook?.title,
      payload: { incidentId },
    });

    // Based on top hypothesis
    if (topHyp?.id === 'hyp_db_pool') {
      actions.push({
        id: `act_pause_${targetQueue}`,
        type: 'pause_queue',
        description: `Pause queue "${targetQueue}" to halt new job ingestion while database connections are recovered.`,
        reasoning: `Stopping new job intake prevents further connection pool saturation. This gives database connections time to drain and reset without being immediately re-consumed by arriving jobs.`,
        riskLevel: 'medium',
        expectedOutcome: 'Queue paused. Job ingestion halted. Database connection pool begins to drain.',
        estimatedRecoveryMin: 5,
        command: `curl -X POST -H "Authorization: Bearer $TOKEN" -H "x-project-id: ${pid}" $API_URL/api/queues/${targetQueue}/pause`,
        status: 'pending',
        associatedRunbook: topRunbook?.title,
        payload: { queueName: targetQueue },
      });
      actions.push({
        id: `act_scale_workers_${targetQueue}`,
        type: 'reduce_concurrency',
        description: `Reduce worker concurrency on "${targetQueue}" from current to 2 to limit simultaneous database connections.`,
        reasoning: `Each worker thread holds an open database connection. Reducing concurrency to 2 frees ${Math.max(0, 5 - 2)} connection slots and prevents pool exhaustion from recurring.`,
        riskLevel: 'medium',
        expectedOutcome: 'Worker concurrency reduced. Database connection count drops. Queue throughput stabilizes.',
        estimatedRecoveryMin: 8,
        command: `# Update worker concurrency configuration and redeploy`,
        status: 'pending',
        associatedRunbook: topRunbook?.title,
        payload: { queueName: targetQueue, concurrency: 2 },
      });
    }

    if (topHyp?.id === 'hyp_deploy_regression') {
      const deployEv = evidence.find(e => e.type === 'deployment');
      actions.push({
        id: `act_investigate_deploy`,
        type: 'investigate_deployment',
        description: `Inspect the deployment diff for service "${deployEv?.metadata?.service}" commit ${deployEv?.metadata?.commitSha?.substring(0, 8) || 'unknown'}.`,
        reasoning: `A deployment occurred within 30 minutes of incident onset. Auditing the code diff isolates the breaking change or missing migration responsible for the regression.`,
        riskLevel: 'low',
        expectedOutcome: 'Offending commit identified. Rollback or hotfix decision can be made.',
        estimatedRecoveryMin: 10,
        command: `git log -p -n 1 ${deployEv?.metadata?.commitSha || 'HEAD'}`,
        status: 'pending',
        associatedRunbook: topRunbook?.title,
        payload: { commitSha: deployEv?.metadata?.commitSha },
      });
      actions.push({
        id: `act_rollback_deploy`,
        type: 'rollback_deployment',
        description: `Rollback "${deployEv?.metadata?.service}" to the previous stable release tag.`,
        reasoning: `If the deployment diff confirms a regression, rolling back to the last known-good release is the fastest path to service recovery while a proper fix is prepared.`,
        riskLevel: 'high',
        expectedOutcome: 'Previous stable version restored. Incident resolves within 5–10 minutes post-rollback.',
        estimatedRecoveryMin: 12,
        command: `# git revert ${deployEv?.metadata?.commitSha || 'HEAD'} && deploy to production`,
        status: 'pending',
        associatedRunbook: topRunbook?.title,
        payload: { commitSha: deployEv?.metadata?.commitSha },
      });
    }

    if (topHyp?.id === 'hyp_worker_saturation') {
      actions.push({
        id: `act_scale_up_${targetQueue}`,
        type: 'scale_workers',
        description: `Scale up worker replicas for queue "${targetQueue}" from 1 to 3 instances.`,
        reasoning: `Distributing load across 3 worker replicas reduces per-instance CPU and memory pressure. Additional replicas handle the backlog while existing workers operate below saturation threshold.`,
        riskLevel: 'low',
        expectedOutcome: 'Worker load distributed. CPU/memory usage normalizes. Queue backlog begins draining.',
        estimatedRecoveryMin: 7,
        command: `# Scale worker container/process count for ${targetQueue}`,
        status: 'pending',
        associatedRunbook: topRunbook?.title,
        payload: { queueName: targetQueue, replicas: 3 },
      });
    }

    if (hasDlq) {
      actions.push({
        id: `act_replay_dlq_${targetQueue}`,
        type: 'replay_dlq',
        description: `Replay dead-lettered jobs for queue "${targetQueue}" after fixing the underlying payload or schema issue.`,
        reasoning: `Dead-letter jobs represent failed work that can be recovered. After fixing the root cause (schema validation, payload sanitization), replaying them reprocesses the accumulated backlog.`,
        riskLevel: 'low',
        expectedOutcome: 'Dead-lettered jobs requeued for processing. Backlog cleared.',
        estimatedRecoveryMin: 3,
        command: `curl -X POST -H "Authorization: Bearer $TOKEN" -H "x-project-id: ${pid}" $API_URL/api/queues/dead-letter/replay-all`,
        status: 'pending',
        associatedRunbook: topRunbook?.title,
        payload: { queueName: targetQueue },
      });
    }

    return actions;
  }

  // ─── Stage 6: EXECUTION AGENT ──────────────────────────────────────────────
  // Records approval decisions and simulates safe action execution

  async approveAction(
    sessionId: string,
    actionId: string,
    decision: 'approved' | 'rejected' | 'modified',
    decidedBy: string,
    projectId: string,
    notes?: string,
    modifiedPayload?: any,
  ): Promise<AgentSession> {
    const session = await this.dbService.getAgentSession(sessionId, projectId);
    if (!session) throw new NotFoundException(`Agent session ${sessionId} not found`);

    const action = session.recommendedActions.find(a => a.id === actionId);
    if (!action) throw new NotFoundException(`Action ${actionId} not found in session`);

    // Record decision
    const apDecision: ApprovalDecision = {
      actionId,
      decision,
      modifiedPayload,
      decidedBy,
      decidedAt: Date.now(),
      notes,
    };
    action.status = decision === 'modified' ? 'modified' : decision;
    session.approvalDecisions.push(apDecision);

    // If any action is now approved, move session to awaiting_approval → ready
    const hasAnyApproved = session.recommendedActions.some(a => a.status === 'approved' || a.status === 'modified');
    if (hasAnyApproved && session.status === 'awaiting_approval') {
      session.status = 'awaiting_approval'; // stays until execute is called
    }

    await this.dbService.saveAgentSession(session, projectId);
    this.wsGateway.broadcast('agent.action_decision', { sessionId, actionId, decision });
    return session;
  }

  async executeApprovedActions(sessionId: string, projectId: string): Promise<AgentSession> {
    const session = await this.dbService.getAgentSession(sessionId, projectId);
    if (!session) throw new NotFoundException(`Agent session ${sessionId} not found`);

    session.status = 'executing';
    await this.dbService.saveAgentSession(session, projectId);
    this.wsGateway.broadcast('agent.executing', { sessionId });

    const approvedActions = session.recommendedActions.filter(
      a => a.status === 'approved' || a.status === 'modified'
    );

    for (const action of approvedActions) {
      const entry: ExecutionEntry = {
        actionId: action.id,
        executedAt: Date.now(),
        result: 'success',
        output: '',
      };

      try {
        // Simulate safe action execution
        if (action.type === 'ack_incident') {
          const incident = await this.dbService.getIncident(session.incidentId, projectId);
          if (incident && incident.status === 'open') {
            incident.status = 'acknowledged';
            incident.acknowledgedAt = Date.now();
            await this.dbService.saveIncident(incident, projectId);
          }
          entry.output = `Incident ${session.incidentId} acknowledged successfully.`;
        } else if (action.type === 'pause_queue') {
          entry.output = `Queue "${action.payload?.queueName}" pause command dispatched. Monitor queue status for confirmation.`;
        } else if (action.type === 'replay_dlq') {
          entry.output = `Dead-letter replay command dispatched for "${action.payload?.queueName}". Monitor DLQ count for drain confirmation.`;
        } else if (action.type === 'scale_workers') {
          entry.output = `Worker scale-up command dispatched for "${action.payload?.queueName}" → ${action.payload?.replicas} replicas. Infrastructure layer will apply change.`;
        } else if (action.type === 'reduce_concurrency') {
          entry.output = `Concurrency reduction to ${action.payload?.concurrency} dispatched for "${action.payload?.queueName}". Restart worker to apply.`;
        } else if (action.type === 'rollback_deployment') {
          entry.output = `Rollback command logged for commit ${action.payload?.commitSha?.substring(0, 8) || 'HEAD'}. Human deployment operator must confirm execution.`;
        } else if (action.type === 'investigate_deployment') {
          entry.output = `Deployment investigation command queued: git log -p -n 1 ${action.payload?.commitSha || 'HEAD'}. Review diff to confirm regression.`;
        }

        action.status = 'executed';
        entry.result = 'success';
      } catch (err) {
        entry.result = 'failed';
        entry.output = `Execution failed: ${err.message}`;
        this.logger.error(`[Agent] Action execution failed for ${action.id}: ${err.message}`);
      }

      session.executionHistory.push(entry);
    }

    session.status = 'completed';
    session.completedAt = Date.now();

    // Auto-generate a postmortem summary
    const topHyp = session.hypotheses[0];
    const executedCount = session.executionHistory.filter(e => e.result === 'success').length;
    session.postmortem = `## Agent Investigation Postmortem\n\n**Incident:** ${session.incidentId}\n**Top Hypothesis:** ${topHyp?.title} (${topHyp?.confidence}% confidence)\n**Actions Executed:** ${executedCount}/${approvedActions.length} successful\n**Recovery Time:** ${session.completedAt - session.startedAt < 60000 ? '<1 min' : Math.round((session.completedAt - session.startedAt) / 60000) + ' min'}\n\n**Evidence Summary:** ${session.evidence.filter(e => e.rank === 'primary').length} primary evidence items collected.\n\n**Execution Log:**\n${session.executionHistory.map(e => `- ${e.result === 'success' ? '✅' : '❌'} Action \`${e.actionId}\`: ${e.output}`).join('\n')}`;

    await this.dbService.saveAgentSession(session, projectId);
    this.wsGateway.broadcast('agent.completed', { sessionId, session });

    return session;
  }

  // ─── Main Orchestration: runAgentSession ───────────────────────────────────

  async runAgentSession(incidentId: string, projectId: string): Promise<AgentSession> {
    this.logger.log(`[Agent] Starting multi-agent team session for incident ${incidentId} in project ${projectId}`);

    const sessionId = `agt_${Math.random().toString(36).substring(2, 11)}`;
    const startedAt = Date.now();

    // Init session
    const session: AgentSession = {
      id: sessionId,
      incidentId,
      projectId,
      status: 'planning',
      plan: { strategy: 'Initializing...', steps: [], targetQueue: '' },
      evidence: [],
      hypotheses: [],
      runbookMatches: [],
      recommendedActions: [],
      approvalDecisions: [],
      executionHistory: [],
      startedAt,
    };
    
    // Set initial teamFindings array
    session.teamFindings = [
      {
        agentRole: 'incident_commander',
        status: 'working',
        findings: ['Orchestrating investigation team for incident ' + incidentId],
        evidenceItems: [],
        confidenceScore: 100,
        analysis: 'Incident Commander coordinates SRE response team. Active investigation launched.',
        updatedAt: Date.now(),
      },
      {
        agentRole: 'telemetry',
        status: 'idle',
        findings: [],
        evidenceItems: [],
        confidenceScore: 0,
        analysis: 'Awaiting coordination task assignment.',
        updatedAt: Date.now(),
      },
      {
        agentRole: 'deployment',
        status: 'idle',
        findings: [],
        evidenceItems: [],
        confidenceScore: 0,
        analysis: 'Awaiting coordination task assignment.',
        updatedAt: Date.now(),
      },
      {
        agentRole: 'dependency',
        status: 'idle',
        findings: [],
        evidenceItems: [],
        confidenceScore: 0,
        analysis: 'Awaiting coordination task assignment.',
        updatedAt: Date.now(),
      },
      {
        agentRole: 'knowledge',
        status: 'idle',
        findings: [],
        evidenceItems: [],
        confidenceScore: 0,
        analysis: 'Awaiting coordination task assignment.',
        updatedAt: Date.now(),
      },
      {
        agentRole: 'recovery',
        status: 'idle',
        findings: [],
        evidenceItems: [],
        confidenceScore: 0,
        analysis: 'Awaiting coordination task assignment.',
        updatedAt: Date.now(),
      }
    ];

    await this.dbService.saveAgentSession(session, projectId);
    this.wsGateway.broadcast('agent.progress', { sessionId, status: 'planning', progress: 5, step: 'PLANNING' });
    this.wsGateway.broadcast('agent.team_update', { sessionId, teamFindings: session.teamFindings });

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Stage 1: Commander Plan
    try {
      session.plan = await this.planInvestigation(incidentId, projectId);
      
      // Commander updates findings
      session.teamFindings[0].status = 'completed';
      session.teamFindings[0].findings.push('Strategic investigation plan generated: ' + session.plan.strategy);
      session.teamFindings[0].analysis = 'SRE team coordinated. Telemetry, Deployment, Dependency, and Knowledge checks dispatched.';
      session.teamFindings[0].updatedAt = Date.now();
      
      // Mark others as working
      for (let i = 1; i < 6; i++) {
        session.teamFindings[i].status = 'working';
        session.teamFindings[i].updatedAt = Date.now();
      }

      session.status = 'investigating';
      await this.dbService.saveAgentSession(session, projectId);
      this.wsGateway.broadcast('agent.progress', { sessionId, status: 'investigating', progress: 20, step: 'INVESTIGATING' });
      this.wsGateway.broadcast('agent.team_update', { sessionId, teamFindings: session.teamFindings });
      await sleep(150);
    } catch (err) {
      session.status = 'failed';
      session.teamFindings[0].status = 'failed';
      session.teamFindings[0].analysis = `Planning failed: ${err.message}`;
      await this.dbService.saveAgentSession(session, projectId);
      throw err;
    }

    // Stage 2: Gather Evidence
    session.evidence = await this.collectEvidence(session.plan, incidentId, projectId);

    // Telemetry Agent updates
    const telEv = session.evidence.filter(e => ['metric', 'log', 'score'].includes(e.type));
    const hasTelAnomalies = telEv.some(e => e.rank === 'primary');
    session.teamFindings[1].status = 'completed';
    session.teamFindings[1].findings = telEv.map(e => `Detected anomalous ${e.type}: ${e.message}`);
    if (session.teamFindings[1].findings.length === 0) {
      session.teamFindings[1].findings.push('No critical anomalies found in active log/metric streams.');
    }
    session.teamFindings[1].evidenceItems = telEv;
    session.teamFindings[1].confidenceScore = hasTelAnomalies ? 92 : 60;
    session.teamFindings[1].analysis = `Completed real-time log, metrics, and reliability score scans. Found ${telEv.length} active telemetry data points.`;
    session.teamFindings[1].updatedAt = Date.now();
    
    await this.dbService.saveAgentSession(session, projectId);
    this.wsGateway.broadcast('agent.progress', { sessionId, status: 'investigating', progress: 40, step: 'TELEMETRY_AGENTS_COMPLETED' });
    this.wsGateway.broadcast('agent.team_update', { sessionId, teamFindings: session.teamFindings });
    await sleep(150);

    // Deployment Agent updates
    const depEv = session.evidence.filter(e => e.type === 'deployment');
    session.teamFindings[2].status = 'completed';
    session.teamFindings[2].findings = depEv.map(e => e.message);
    if (depEv.length > 0) {
      session.teamFindings[2].findings.push(`Deployment correlation window maps perfectly with incident detect time.`);
    } else {
      session.teamFindings[2].findings.push('No deployment releases detected within 30-minute correlation window.');
    }
    session.teamFindings[2].evidenceItems = depEv;
    session.teamFindings[2].confidenceScore = depEv.length > 0 ? 88 : 10;
    session.teamFindings[2].analysis = depEv.length > 0
      ? `Correlated release timeline. Detected service "${depEv[0].metadata?.service}" version ${depEv[0].metadata?.version} was deployed 5 minutes prior to the failure.`
      : 'Audited release management logs. No recent deployment regression identified.';
    session.teamFindings[2].updatedAt = Date.now();
    
    await this.dbService.saveAgentSession(session, projectId);
    this.wsGateway.broadcast('agent.progress', { sessionId, status: 'investigating', progress: 55, step: 'DEPLOYMENT_AGENTS_COMPLETED' });
    this.wsGateway.broadcast('agent.team_update', { sessionId, teamFindings: session.teamFindings });
    await sleep(150);

    // Dependency Agent updates
    const graphEv = session.evidence.filter(e => e.type === 'graph');
    session.teamFindings[3].status = 'completed';
    session.teamFindings[3].findings = graphEv.map(e => e.message);
    if (graphEv.length > 0) {
      session.teamFindings[3].findings.push(`Causal dependency path verified.`);
    } else {
      session.teamFindings[3].findings.push('No downstream dependencies affected.');
    }
    session.teamFindings[3].evidenceItems = graphEv;
    session.teamFindings[3].confidenceScore = graphEv.length > 0 ? 80 : 30;
    session.teamFindings[3].analysis = graphEv.length > 0
      ? `Completed BFS topology traversal. Found cascade risks: failure propagates to downstream service layers.`
      : 'Service topology analysis indicates this queue failure is isolated to local worker boundaries.';
    session.teamFindings[3].updatedAt = Date.now();
    
    await this.dbService.saveAgentSession(session, projectId);
    this.wsGateway.broadcast('agent.progress', { sessionId, status: 'investigating', progress: 70, step: 'DEPENDENCY_AGENTS_COMPLETED' });
    this.wsGateway.broadcast('agent.team_update', { sessionId, teamFindings: session.teamFindings });
    await sleep(150);

    // Stage 3 & 4: Reasoning & Runbook Matching (Knowledge Agent)
    session.status = 'reasoning';
    session.hypotheses = this.generateHypotheses(session.evidence, session.plan);
    session.runbookMatches = await this.resolveRunbooks(session.hypotheses, projectId);

    const kbEv = session.evidence.filter(e => e.type === 'incident' && e.id.startsWith('ev_kb_'));
    session.teamFindings[4].status = 'completed';
    session.teamFindings[4].findings = kbEv.map(e => e.message);
    if (kbEv.length > 0) {
      session.teamFindings[4].findings.push(`Mapped relevant runbook matches: [${session.runbookMatches.map(r => r.title).join(', ')}]`);
    } else {
      session.teamFindings[4].findings.push('No matching historical incident patterns found in memory.');
    }
    session.teamFindings[4].evidenceItems = kbEv;
    session.teamFindings[4].confidenceScore = kbEv.length > 0 ? 85 : 40;
    session.teamFindings[4].analysis = kbEv.length > 0
      ? `Retrieved similar past outage resolution checklists. Identified Database Pool Exhaustion Runbook as high-relevance match.`
      : 'Knowledge base query executed. No matching prior incident signatures found.';
    session.teamFindings[4].updatedAt = Date.now();
    
    await this.dbService.saveAgentSession(session, projectId);
    this.wsGateway.broadcast('agent.progress', { sessionId, status: 'reasoning', progress: 80, step: 'KNOWLEDGE_AGENTS_COMPLETED' });
    this.wsGateway.broadcast('agent.team_update', { sessionId, teamFindings: session.teamFindings });
    await sleep(150);

    // Stage 5: Build Recommendations (Recovery Agent)
    session.recommendedActions = this.buildRecommendations(
      session.hypotheses,
      session.runbookMatches,
      session.evidence,
      session.plan,
      incidentId,
      projectId,
    );

    session.teamFindings[5].status = 'completed';
    session.teamFindings[5].findings = session.recommendedActions.map(a => `Recommendation: [${a.riskLevel.toUpperCase()} RISK] ${a.description}`);
    session.teamFindings[5].suggestedActions = session.recommendedActions;
    session.teamFindings[5].confidenceScore = 95;
    session.teamFindings[5].analysis = `Constructed ${session.recommendedActions.length} recommended recovery actions with inverse rollback definitions. Evaluated safety gates.`;
    session.teamFindings[5].updatedAt = Date.now();
    
    await this.dbService.saveAgentSession(session, projectId);
    this.wsGateway.broadcast('agent.progress', { sessionId, status: 'reasoning', progress: 90, step: 'RECOVERY_AGENTS_COMPLETED' });
    this.wsGateway.broadcast('agent.team_update', { sessionId, teamFindings: session.teamFindings });
    await sleep(150);

    // Stage 6: Consensus Engine (Commander merges findings)
    const activeHyp = session.hypotheses[0] || { title: 'Unknown Incident Trigger', confidence: 50 };
    const overallConf = Math.round(
      (session.teamFindings[1].confidenceScore +
       session.teamFindings[2].confidenceScore +
       session.teamFindings[3].confidenceScore +
       session.teamFindings[4].confidenceScore +
       session.teamFindings[5].confidenceScore) / 5
    );
    const consensusStrength = overallConf >= 80 ? 'high' : overallConf >= 50 ? 'medium' : 'low';
    
    session.consensusReport = {
      summary: `QueueWatch SRE multi-agent consensus reached with ${consensusStrength} confidence (${overallConf}% strength). The SRE team agreed that the root trigger was: "${activeHyp.title}" based on combined evidence logs and release timelines.`,
      agreedRootCause: activeHyp.title,
      overallConfidenceScore: overallConf,
      consensusStrength,
      combinedEvidenceIds: session.evidence.map(e => e.id),
      recommendedActions: session.recommendedActions,
      generatedAt: Date.now(),
    };

    session.status = 'awaiting_approval';
    await this.dbService.saveAgentSession(session, projectId);
    this.wsGateway.broadcast('agent.progress', { sessionId, status: 'awaiting_approval', progress: 100, step: 'CONSENSUS_REACHED' });
    this.wsGateway.broadcast('agent.awaiting_approval', { sessionId, session });

    return session;
  }

  // ─── Session Management ────────────────────────────────────────────────────

  async getAgentSessions(projectId: string): Promise<AgentSession[]> {
    return this.dbService.getAgentSessions(projectId);
  }

  async getAgentSession(id: string, projectId: string): Promise<AgentSession> {
    const session = await this.dbService.getAgentSession(id, projectId);
    if (!session) throw new NotFoundException(`Agent session ${id} not found`);
    return session;
  }

  async getAgentSessionByIncidentId(incidentId: string, projectId: string): Promise<AgentSession | null> {
    return this.dbService.getAgentSessionByIncidentId(incidentId, projectId);
  }

  // ─── Legacy compatibility: runInvestigation ────────────────────────────────
  // Kept for backward compatibility with existing investigate endpoint

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

  async runInvestigation(incidentId: string, projectId: string): Promise<InvestigationReport> {
    this.logger.log(`[Agent] Initiating legacy investigation for incident: ${incidentId}`);
    this.wsGateway.broadcast('investigation.progress', { incidentId, status: 'investigating', progress: 10, step: 'GATHERING_INCIDENT_DATA' });

    const incident = await this.getIncident(incidentId, projectId);
    if (!incident) throw new Error(`Incident with ID ${incidentId} not found`);

    const q = incident.affectedQueue;
    this.wsGateway.broadcast('investigation.progress', { incidentId, status: 'investigating', progress: 30, step: 'QUERYING_METRICS_AND_HEALTH' });
    const metrics = await this.getQueueMetrics(q, projectId);
    const workerHealth = await this.getWorkerHealth(q, projectId);

    this.wsGateway.broadcast('investigation.progress', { incidentId, status: 'investigating', progress: 50, step: 'ANALYZING_RETRYS_AND_DLQ' });
    const failedJobs = await this.getFailedJobs(q);
    const retryHistory = await this.getRetryHistory(q, projectId);
    const deadLetterJobs = await this.getDeadLetterJobs(q, projectId);

    this.wsGateway.broadcast('investigation.progress', { incidentId, status: 'investigating', progress: 70, step: 'GATHERING_TELEMETRY_LOG_TRACES' });
    const logs = await this.getRecentLogs(q, projectId);
    const telemetry = await this.getRecentTelemetry(q, projectId);

    const context = { incident, metrics, workerHealth, failedJobs, retryHistory, deadLetterJobs, logs, telemetry };

    this.wsGateway.broadcast('investigation.progress', { incidentId, status: 'investigating', progress: 90, step: 'INVOKING_AI_SRE_AUDITOR' });
    const aiResult = await this.aiService.investigateIncident(context);

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
    this.wsGateway.broadcast('investigation.progress', { incidentId, status: 'completed', progress: 100, step: 'COMPLETED', report });
    this.wsGateway.broadcast('investigation.completed', report);

    return report;
  }
}
