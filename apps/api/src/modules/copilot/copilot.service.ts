import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { ConfigService } from '@nestjs/config';
import { CopilotResponse, EvidenceItem, ActionRecommendation, CopilotLogEntry, CopilotHypothesis, InvestigationGraph } from '@queuewatch/shared';
import { CorrelationService } from './correlation.service';

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private readonly dbService: DbService,
    private readonly configService: ConfigService,
    private readonly correlationService: CorrelationService
  ) {}

  async getSuggestions(): Promise<string[]> {
    return [
      'Why is webhook_delivery failing?',
      'What changed before this incident?',
      'Which queue has the highest retry rate?',
      'What caused this backlog growth?',
      'Which incidents occurred after the latest deployment?',
      'Which workers are unhealthy?'
    ];
  }

  async getKnowledgeBase(projectId?: string) {
    return this.dbService.getKnowledgeEntries(projectId);
  }

  async queryCopilot(prompt: string, projectId?: string, contextIncidentId?: string): Promise<CopilotResponse> {
    const lowerPrompt = prompt.toLowerCase();
    const projectQueues = await this.dbService.getProjectQueues(projectId || 'proj_demo');
    
    let targetQueue = '';
    
    // 1. If we have contextIncidentId, fetch the incident to get the target queue
    if (contextIncidentId) {
      const incident = await this.dbService.getIncident(contextIncidentId, projectId);
      if (incident) {
        targetQueue = incident.affectedQueue;
      }
    }
    
    // 2. If targetQueue is still empty, scan prompt for any queue names
    if (!targetQueue) {
      for (const q of projectQueues) {
        if (lowerPrompt.includes(q.toLowerCase())) {
          targetQueue = q;
          break;
        }
      }
    }
    
    // 3. Fallback to keyword matching if still empty
    if (!targetQueue) {
      if (/\b(email|smtp)\b/.test(lowerPrompt)) targetQueue = 'email_notifications';
      else if (/\b(webhook|stripe)\b/.test(lowerPrompt)) targetQueue = 'webhook_delivery';
      else if (/\b(image|sharp)\b/.test(lowerPrompt)) targetQueue = 'image_processing';
      else if (/\b(ai|llama)\b/.test(lowerPrompt)) targetQueue = 'ai_tasks';
      else if (/\b(payment)\b/.test(lowerPrompt)) targetQueue = 'payment_queue';
    }

    // Match service mapping if any
    const services = await this.dbService.getServices(projectId);
    let targetService = '';
    for (const svc of services) {
      if (lowerPrompt.includes(svc.name.toLowerCase()) || lowerPrompt.includes(svc.id.toLowerCase())) {
        targetService = svc.id;
        if (svc.queues && svc.queues.length > 0 && !targetQueue) {
          targetQueue = svc.queues[0];
        }
        break;
      }
    }

    // Gather raw evidence sources
    const incidents = await this.dbService.getIncidents(projectId);
    const logs = await this.dbService.getLogs(undefined, 200, projectId);
    const deployments = await this.dbService.getDeploymentEvents(projectId);
    const reliabilityScores = await this.dbService.getReliabilityScores(projectId);
    const depGraph = await this.dbService.getDependencyGraph(projectId);

    const evidence: EvidenceItem[] = [];
    const recommendedActions: ActionRecommendation[] = [];
    let confidence: 'low' | 'medium' | 'high' = 'low';
    let confidenceScore = 30;

    // A. Gather target queue reliability scores
    if (targetQueue) {
      const qScore = reliabilityScores.find(s => s.targetId === targetQueue && s.targetType === 'queue');
      if (qScore) {
        evidence.push({
          id: `ev_score_q_${targetQueue}`,
          type: 'score',
          rank: 'context',
          message: `Reliability score for queue "${targetQueue}" is at ${qScore.score}%.`,
          metadata: { score: qScore.score }
        });
        if (qScore.contributors) {
          for (const [key, val] of Object.entries(qScore.contributors)) {
            if (val < 0) {
              evidence.push({
                id: `ev_score_contr_${targetQueue}_${key}`,
                type: 'score',
                rank: 'context',
                message: `Deduction: ${val} points on "${targetQueue}" due to ${key}.`
              });
            }
          }
        }
      }
    }

    // B. Gather target service reliability scores
    if (targetService) {
      const sScore = reliabilityScores.find(s => s.targetId === targetService && s.targetType === 'service');
      if (sScore) {
        evidence.push({
          id: `ev_score_s_${targetService}`,
          type: 'score',
          rank: 'context',
          message: `Reliability score for service "${targetService}" is at ${sScore.score}%.`,
          metadata: { score: sScore.score }
        });
      }
    }

    // C. Gather active incidents
    const activeIncidents = incidents.filter(i => 
      i.status !== 'resolved' && 
      (targetQueue ? i.affectedQueue === targetQueue : true)
    );
    for (const inc of activeIncidents) {
      evidence.push({
        id: `ev_inc_${inc.id}`,
        type: 'incident',
        rank: 'primary',
        message: `Active ${inc.severity} incident #${inc.id} (${inc.title}) affecting queue "${inc.affectedQueue}".`,
        timestamp: inc.firstDetectedAt,
        metadata: { incidentId: inc.id }
      });
      
      if (inc.status === 'open') {
        recommendedActions.push({
          type: 'ack_incident',
          incidentId: inc.id,
          description: `Acknowledge incident #${inc.id} to take ownership.`,
          command: `curl -X PATCH -H "Authorization: Bearer \\$TOKEN" -H "x-project-id: ${projectId || 'proj_demo'}" \\$API_URL/api/incidents/${inc.id}/acknowledge`
        });
      }
    }

    // D. Filter logs for error messages
    const queueErrors = logs.filter(l => 
      l.level === 'error' && 
      (targetQueue ? l.queueName === targetQueue : true)
    ).slice(0, 3);
    for (const err of queueErrors) {
      evidence.push({
        id: `ev_log_${err.id || err.timestamp || Math.random().toString(36).substring(2, 9)}`,
        type: 'log',
        rank: 'primary',
        message: `Error message: "${err.message}" inside queue "${err.queueName}".`,
        timestamp: err.timestamp,
        metadata: { jobId: err.jobId, traceId: err.traceId }
      });
    }

    // E. Correlate recent deployments
    let correlatedDeployment: any = null;
    const firstActiveIncident = activeIncidents[0];
    if (firstActiveIncident) {
      correlatedDeployment = deployments.find(d =>
        d.deployedAt <= firstActiveIncident.firstDetectedAt &&
        firstActiveIncident.firstDetectedAt - d.deployedAt <= 30 * 60 * 1000 &&
        (targetQueue ? (d.service === targetQueue || firstActiveIncident.title.toLowerCase().includes(d.service.toLowerCase())) : true)
      );
    }
    if (correlatedDeployment) {
      evidence.push({
        id: `ev_dep_${correlatedDeployment.id || correlatedDeployment.commitSha}`,
        type: 'deployment',
        rank: 'secondary',
        message: `Deployment regression detected: Service "${correlatedDeployment.service}" version ${correlatedDeployment.version} was deployed ${Math.round((firstActiveIncident.firstDetectedAt - correlatedDeployment.deployedAt) / 60000)} minutes before the incident first detected time.`,
        timestamp: correlatedDeployment.deployedAt,
        metadata: { version: correlatedDeployment.version, commitSha: correlatedDeployment.commitSha }
      });
      recommendedActions.push({
        type: 'investigate_deployment',
        description: `Investigate release diff for service "${correlatedDeployment.service}" commit ${correlatedDeployment.commitSha.substring(0, 8)} (${correlatedDeployment.version}).`,
        command: `git log -p -n 1 ${correlatedDeployment.commitSha}`
      });
    }

    // F. Downstream Blast Radius cascades
    const downstreamAffected: string[] = [];
    if (targetQueue && depGraph && depGraph.edges) {
      const serviceOwningQueue = services.find(s => s.queues && s.queues.includes(targetQueue));
      const startNode = serviceOwningQueue ? serviceOwningQueue.id : targetQueue;
      
      const visited = new Set<string>();
      const bfsQueue = [startNode];
      visited.add(startNode);
      
      while (bfsQueue.length > 0) {
        const curr = bfsQueue.shift()!;
        const edges = depGraph.edges.filter(e => e.from === curr);
        for (const edge of edges) {
          if (!visited.has(edge.to)) {
            visited.add(edge.to);
            bfsQueue.push(edge.to);
            const nodeDetails = depGraph.nodes.find(n => n.id === edge.to);
            const name = nodeDetails ? nodeDetails.label : edge.to;
            downstreamAffected.push(name);
          }
        }
      }
    }
    if (downstreamAffected.length > 0) {
      evidence.push({
        id: `ev_graph_blast_${targetQueue}`,
        type: 'graph',
        rank: 'context',
        message: `Blast radius analysis: Outage affects downstream components [${downstreamAffected.join(', ')}].`,
        metadata: { downstream: downstreamAffected }
      });
    }

    // Add general queue actions if targetQueue is set
    if (targetQueue) {
      recommendedActions.push({
        type: 'pause_queue',
        queueName: targetQueue,
        description: `Temporarily pause queue "${targetQueue}" to prevent backlog buildup during outage.`,
        command: `curl -X POST -H "Authorization: Bearer \\$TOKEN" -H "x-project-id: ${projectId || 'proj_demo'}" \\$API_URL/api/queues/${targetQueue}/pause`
      });
      
      if (queueErrors.length > 0) {
        recommendedActions.push({
          type: 'replay_dlq',
          queueName: targetQueue,
          description: `Replay failed dead-lettered jobs for queue "${targetQueue}".`,
          command: `curl -X POST -H "Authorization: Bearer \\$TOKEN" -H "x-project-id: ${projectId || 'proj_demo'}" \\$API_URL/api/queues/dead-letter/replay-all`
        });
      }
    }

    // G. Confidence Score assignment
    if (evidence.length === 0) {
      confidence = 'low';
      confidenceScore = 20;
    } else {
      const hasIncident = evidence.some(e => e.type === 'incident');
      const hasErrors = evidence.some(e => e.type === 'log');
      const hasDeployment = evidence.some(e => e.type === 'deployment');
      
      if (hasIncident && (hasErrors || hasDeployment)) {
        confidence = 'high';
        confidenceScore = 90;
      } else if (hasIncident || hasErrors) {
        confidence = 'medium';
        confidenceScore = 60;
      } else {
        confidence = 'low';
        confidenceScore = 40;
      }
    }

    // H. Generate Hypotheses deterministically
    const hypotheses: CopilotHypothesis[] = [];
    if (evidence.length > 0) {
      if (correlatedDeployment) {
        const depEv = evidence.find(e => e.type === 'deployment');
        const incEvs = evidence.filter(e => e.type === 'incident' || e.type === 'log').map(e => e.id);
        const evidenceIds = depEv ? [depEv.id, ...incEvs] : incEvs;
        
        hypotheses.push({
          id: 'hyp_dep_regression',
          title: 'Deployment Regression',
          description: `The deployment of service "${correlatedDeployment.service}" v${correlatedDeployment.version} occurred just before the failure. It is highly likely that this deployment introduced a bug or configuration issue.`,
          confidence: activeIncidents.length > 0 ? 85 : 50,
          evidenceIds
        });
      }
      
      if (queueErrors.length > 0) {
        const logEvs = evidence.filter(e => e.type === 'log').map(e => e.id);
        const incEvs = evidence.filter(e => e.type === 'incident').map(e => e.id);
        
        hypotheses.push({
          id: 'hyp_service_errors',
          title: 'Exception Spike in Worker',
          description: `Multiple error logs were recorded in queue "${targetQueue || 'unknown'}". Workers are throwing unhandled exceptions during job execution.`,
          confidence: activeIncidents.length > 0 ? 90 : 70,
          evidenceIds: [...logEvs, ...incEvs]
        });
      }
      
      if (downstreamAffected.length > 0) {
        const graphEv = evidence.find(e => e.type === 'graph');
        hypotheses.push({
          id: 'hyp_downstream_cascade',
          title: 'Downstream Cascade Risk',
          description: `The queue outage on "${targetQueue}" is propagating downstream, impacting dependent components: [${downstreamAffected.join(', ')}].`,
          confidence: 60,
          evidenceIds: graphEv ? [graphEv.id] : []
        });
      }
      
      // Fallback hypothesis if none generated
      if (hypotheses.length === 0) {
        hypotheses.push({
          id: 'hyp_unknown_degradation',
          title: 'Unclassified Performance Degradation',
          description: `The queue "${targetQueue}" is showing indicators of degradation, but no recent error logs or deployments directly correlate to a single root cause.`,
          confidence: 30,
          evidenceIds: evidence.map(e => e.id)
        });
      }
    }

    // I. Generate Investigation Graph deterministically
    const graphNodes: any[] = [];
    const graphEdges: { from: string; to: string }[] = [];
    let lastNodeId = '';
    
    if (correlatedDeployment) {
      const id = `node_dep_${correlatedDeployment.commitSha}`;
      graphNodes.push({
        id,
        type: 'deployment',
        label: `Deploy: ${correlatedDeployment.service} (${correlatedDeployment.version})`,
        timestamp: correlatedDeployment.deployedAt
      });
      lastNodeId = id;
    }
    
    if (queueErrors.length > 0) {
      const id = 'node_log_err';
      graphNodes.push({
        id,
        type: 'log',
        label: `Errors: ${queueErrors[0].message.substring(0, 40)}...`,
        timestamp: queueErrors[0].timestamp
      });
      if (lastNodeId) {
        graphEdges.push({ from: lastNodeId, to: id });
      }
      lastNodeId = id;
    }
    
    if (activeIncidents.length > 0) {
      const id = `node_inc_${activeIncidents[0].id}`;
      graphNodes.push({
        id,
        type: 'incident',
        label: `Incident: ${activeIncidents[0].title}`,
        timestamp: activeIncidents[0].firstDetectedAt
      });
      if (lastNodeId) {
        graphEdges.push({ from: lastNodeId, to: id });
      }
      lastNodeId = id;
    }
    
    if (downstreamAffected.length > 0) {
      const id = 'node_blast_radius';
      graphNodes.push({
        id,
        type: 'blast_radius',
        label: `Blast Radius: ${downstreamAffected.length} downstream components`
      });
      if (lastNodeId) {
        graphEdges.push({ from: lastNodeId, to: id });
      }
      lastNodeId = id;
    }
    
    if (recommendedActions.length > 0) {
      const id = 'node_action_remed';
      graphNodes.push({
        id,
        type: 'action',
        label: `Action: ${recommendedActions[0].description}`
      });
      if (lastNodeId) {
        graphEdges.push({ from: lastNodeId, to: id });
      }
    }
    
    const investigationGraph = {
      nodes: graphNodes,
      edges: graphEdges
    };

    // J. Dynamic Response text generation (Fallback Answer)
    let answer = '';
    if (evidence.length === 0) {
      answer = `I could not find any active incidents, recent deployments, or matching error logs for the specified queue context. More telemetry or target keywords are needed before I can make a reliable reliability diagnosis.`;
    } else {
      const parts: string[] = [];
      if (targetQueue) {
        parts.push(`### 🔍 SRE Investigation: \`${targetQueue}\``);
      } else {
        parts.push(`### 🔍 SRE Investigation`);
      }
      
      const qScore = reliabilityScores.find(s => s.targetId === targetQueue && s.targetType === 'queue');
      if (qScore) {
        parts.push(`- **Reliability Status**: Score is degraded to **${qScore.score}%**. Contributors to this decline:`);
        if (qScore.contributors) {
          for (const [k, v] of Object.entries(qScore.contributors)) {
            if (v < 0) {
              parts.push(`  * **${k}**: ${v} points deduction.`);
            }
          }
        }
      }
      
      if (activeIncidents.length > 0) {
        parts.push(`- **Active Outages**: Detected ${activeIncidents.length} active incident(s):`);
        for (const inc of activeIncidents) {
          parts.push(`  * **Incident #${inc.id}** (${inc.title}): classified as *${inc.severity}*. Suspected root cause: *${inc.suspectedRootCause || 'unverified'}*.`);
        }
      }
      
      if (queueErrors.length > 0) {
        parts.push(`- **Exception Logs**: Recent error signatures enqueued:`);
        for (const err of queueErrors) {
          parts.push(`  * \`${err.message}\``);
        }
      }
      
      if (correlatedDeployment) {
        parts.push(`- **Deployment Correlation**: Service \`${correlatedDeployment.service}\` v${correlatedDeployment.version} (branch \`${correlatedDeployment.branch || 'main'}\`) was deployed by \`${correlatedDeployment.deployedBy}\` at ${new Date(correlatedDeployment.deployedAt).toISOString()} which is **within 30 minutes before** the incident first occurred. This suggests a likely regression.`);
      }
      
      if (downstreamAffected.length > 0) {
        parts.push(`- **Downstream Impact**: Outage cascade threatens downstream services/queues: [${downstreamAffected.join(', ')}].`);
      }
      
      answer = parts.join('\n\n');
    }

    // Try Ollama AI generation
    const ollamaUrl = this.configService.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434';
    const model = this.configService.get<string>('OLLAMA_MODEL') || 'llama3.1';
    const systemPrompt = `You are a senior reliability engineer. Use evidence. Never speculate. Only generate conclusions supported by telemetry. If you cannot find active incidents, logs, or metrics, return a response explaining you have insufficient evidence. Provide operational recommendations. All actions require confirmation.`;
    
    const contextPrompt = `
System Evidence context:
- Target Queue: ${targetQueue || 'All'}
- Evidence Gathered: ${JSON.stringify(evidence)}
- Recommended Actions Base: ${JSON.stringify(recommendedActions)}
- Confidence: ${confidence} (${confidenceScore}%)
- Deterministic Hypotheses: ${JSON.stringify(hypotheses)}
- Deterministic Investigation Graph: ${JSON.stringify(investigationGraph)}

Question: ${prompt}

Format your response strictly as JSON matching this structure:
{
  "answer": "Concise Markdown answer citing logs, incident IDs, deployments, reliability scores, and blast radius.",
  "confidence": "low" | "medium" | "high",
  "evidence": [{"id": "string", "type": "log"|"metric"|"deployment"|"incident"|"score"|"graph", "rank": "primary"|"secondary"|"context", "message": "string", "timestamp": number}],
  "recommendedActions": [{"type": "pause_queue"|"replay_dlq"|"reduce_concurrency"|"ack_incident"|"scale_workers"|"investigate_deployment", "queueName": "string", "incidentId": "string", "description": "string", "command": "string"}],
  "requiresConfirmation": true,
  "hypotheses": [{"id": "string", "title": "string", "description": "string", "confidence": number, "evidenceIds": ["string"]}],
  "investigationGraph": {
    "nodes": [{"id": "string", "type": "deployment"|"log"|"incident"|"blast_radius"|"action", "label": "string", "timestamp": number}],
    "edges": [{"from": "string", "to": "string"}]
  }
}`;

    let copilotResponse: CopilotResponse;

    try {
      this.logger.log(`Connecting to Ollama for Copilot query...`);
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: `${systemPrompt}\n\n${contextPrompt}`,
          stream: false,
          format: 'json',
        }),
      });

      if (response.ok) {
        const resBody: any = await response.json();
        const parsed = JSON.parse(resBody.response.trim());
        copilotResponse = {
          answer: parsed.answer || answer,
          confidence: parsed.confidence || confidence,
          confidenceScore: parsed.confidence === 'high' ? 90 : parsed.confidence === 'medium' ? 60 : 30,
          evidence: parsed.evidence || evidence,
          recommendedActions: parsed.recommendedActions || recommendedActions,
          requiresConfirmation: parsed.requiresConfirmation !== undefined ? parsed.requiresConfirmation : true,
          hypotheses: parsed.hypotheses || hypotheses,
          investigationGraph: parsed.investigationGraph || investigationGraph
        };
      } else {
        throw new Error(`Ollama status: ${response.status}`);
      }
    } catch (e) {
      this.logger.warn(`Ollama copilot query failed: ${e.message}. Using deterministic fallback.`);
      copilotResponse = {
        answer,
        confidence,
        confidenceScore,
        evidence,
        recommendedActions,
        requiresConfirmation: true,
        hypotheses,
        investigationGraph
      };
    }

    // Save to audit log
    const logEntry: CopilotLogEntry = {
      id: `cop_log_${Math.random().toString(36).substring(2, 11)}`,
      question: prompt,
      contextUsed: {
        targetQueue,
        targetService,
        hasIncidents: activeIncidents.length > 0,
        hasErrors: queueErrors.length > 0,
        hasDeployment: !!correlatedDeployment,
        downstreamCount: downstreamAffected.length
      },
      evidence: copilotResponse.evidence,
      answer: copilotResponse.answer,
      confidence: copilotResponse.confidence,
      timestamp: Date.now(),
      incidentId: contextIncidentId || (activeIncidents[0] ? activeIncidents[0].id : undefined),
      queueName: targetQueue || undefined,
      hypotheses: copilotResponse.hypotheses,
      investigationGraph: copilotResponse.investigationGraph
    };
    await this.dbService.saveCopilotLog(logEntry, projectId);

    return copilotResponse;
  }

  async chatIncident(incidentId: string, prompt: string, projectId?: string): Promise<CopilotResponse> {
    const incident = await this.dbService.getIncident(incidentId, projectId);
    if (!incident) {
      return {
        answer: `Incident ${incidentId} not found in database memory.`,
        confidence: 'low',
        confidenceScore: 0,
        evidence: [],
        recommendedActions: [],
        requiresConfirmation: false,
        hypotheses: [],
        investigationGraph: { nodes: [], edges: [] }
      };
    }

    // Frame the prompt in context of the specific incident
    const contextPrompt = `Discussing active Incident ID #${incident.id} (${incident.title}). affected queue: ${incident.affectedQueue}. suspected root cause: ${incident.suspectedRootCause}.\nUser query: ${prompt}`;
    return this.queryCopilot(contextPrompt, projectId, incidentId);
  }

  async getCopilotLogs(projectId?: string): Promise<CopilotLogEntry[]> {
    return this.dbService.getCopilotLogs(projectId);
  }
}
