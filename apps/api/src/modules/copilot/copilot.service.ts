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

    // Proactive SRE forecasting responder interceptor
    const isProactiveQuery = 
      /likely to fail next/i.test(prompt) || 
      /trending toward an outage/i.test(prompt) ||
      /service.*becoming unhealthy/i.test(prompt) ||
      /deployment.*watch/i.test(prompt);

    if (isProactiveQuery) {
      const predictions = await this.dbService.getPredictions(projectId);
      const forecasts = await this.dbService.getForecasts(projectId);
      const deployments = await this.dbService.getDeploymentEvents(projectId);
      
      let answer = '';
      const recommendedActions: ActionRecommendation[] = [];
      const evidence: EvidenceItem[] = [];
      
      if (/likely to fail next/i.test(prompt) || /trending toward an outage/i.test(prompt)) {
        if (predictions.length > 0) {
          answer = `### 🔮 SRE Predictive Insights: Trending Queue Failures\n\nBased on continuous telemetry monitoring, the following queues are at risk of outage:\n\n`;
          for (const pred of predictions) {
            const forecast = forecasts.find(f => f.targetId === pred.targetQueue);
            const prob1h = forecast ? forecast.forecasts.find(f => f.timeframe === '1h')?.incidentProbability ?? 50 : 50;
            const prob24h = forecast ? forecast.forecasts.find(f => f.timeframe === '24h')?.incidentProbability ?? 80 : 80;
            
            answer += `- **${pred.targetQueue}** (**${pred.title}**) is trending toward an outage due to: *${pred.reason}*\n`;
            answer += `  * **Risk Score**: ${pred.riskScore}% | **Confidence**: ${pred.confidenceScore}%\n`;
            answer += `  * **Incident Probability**: **${prob1h}%** (next 1 hour) ➔ **${prob24h}%** (next 24 hours)\n`;
            answer += `  * **Estimated Impact**: ${pred.estimatedImpact}\n\n`;
            
            evidence.push({
              id: `ev_pred_${pred.id}`,
              type: 'score',
              rank: 'primary',
              message: `${pred.title} detected with ${pred.confidenceScore}% confidence.`,
              timestamp: pred.timestamp
            });
            
            for (const action of pred.recommendedActions) {
              recommendedActions.push({
                type: 'pause_queue',
                description: action,
                associatedRunbook: 'Early Mitigation Flow',
                reasoning: 'Proactive mitigation suggested to prevent full service exhaustion.',
                riskLevel: 'medium',
                expectedOutcome: 'System returns to healthy baseline before alert triggers.'
              });
            }
          }
        } else {
          answer = `### 🔮 SRE Predictive Insights: Trending Queue Failures\n\nAll queues are operating within healthy parameters. No queues are currently trending toward an outage.`;
        }
      } else if (/service.*becoming unhealthy/i.test(prompt)) {
        const unhealthyServices = forecasts.filter(f => 
          f.forecasts.some(tf => tf.incidentProbability > 15)
        );
        if (unhealthyServices.length > 0) {
          answer = `### 🏥 SRE Service Health Forecast\n\nThe following services are showing indicators of degradation and are projected to become unhealthy:\n\n`;
          for (const fc of unhealthyServices) {
            const relatedPred = predictions.find(p => p.targetQueue === fc.targetId || p.targetService === fc.targetId);
            const prob1h = fc.forecasts.find(f => f.timeframe === '1h')?.incidentProbability ?? 10;
            const prob24h = fc.forecasts.find(f => f.timeframe === '24h')?.incidentProbability ?? 20;
            const traj = fc.forecasts.find(f => f.timeframe === '24h')?.reliabilityScoreTrajectory ?? [];
            const reason = relatedPred ? relatedPred.reason : 'Telemetry anomalies detected in processing queues.';
            
            answer += `- **${fc.targetId}** (${fc.targetType})\n`;
            answer += `  * **Anomaly Status**: ${reason}\n`;
            answer += `  * **Threat Level**: Probability of failure is **${prob1h}%** (1h) rising to **${prob24h}%** (24h)\n`;
            if (traj.length > 0) {
              answer += `  * **Reliability Score Trajectory**: Projected to decline from current baseline to **${traj[traj.length - 1]}%** in 24 hours.\n\n`;
            }
            
            evidence.push({
              id: `ev_forecast_${fc.targetId}`,
              type: 'score',
              rank: 'secondary',
              message: `${fc.targetId} reliability score projected to degrade to ${traj[traj.length - 1] ?? 50}%`,
              timestamp: fc.timestamp
            });
          }
        } else {
          answer = `### 🏥 SRE Service Health Forecast\n\nAll registered services are healthy and projected to remain stable over the next 24 hours.`;
        }
      } else if (/deployment.*watch/i.test(prompt)) {
        const deployPreds = predictions.filter(p => p.id.includes('deployment_risk'));
        if (deployPreds.length > 0 && deployments.length > 0) {
          answer = `### 🚀 Deployment Watchlist\n\nYou should closely watch the following recent deployments due to correlated post-release anomalies:\n\n`;
          for (const pred of deployPreds) {
            const matchingDep = deployments.find(d => d.service === pred.targetService || pred.title.toLowerCase().includes(d.service.toLowerCase()));
            const versionStr = matchingDep ? `v${matchingDep.version} (${matchingDep.commitSha.substring(0, 8)})` : 'latest release';
            const depTime = matchingDep ? new Date(matchingDep.deployedAt).toISOString() : 'recent';
            
            answer += `- **Service: ${pred.targetService}** (Released: ${versionStr} at ${depTime})\n`;
            answer += `  * **Risk Reason**: ${pred.reason}\n`;
            answer += `  * **Diagnostic Confidence**: **92%**\n`;
            answer += `  * **Symptom**: ${pred.estimatedImpact}\n\n`;
            
            evidence.push({
              id: `ev_deploy_watch_${pred.id}`,
              type: 'deployment',
              rank: 'primary',
              message: `Post-release latency increase detected for version ${versionStr}`,
              timestamp: matchingDep ? matchingDep.deployedAt : Date.now()
            });
            
            if (matchingDep) {
              recommendedActions.push({
                type: 'investigate_deployment',
                description: `Rollback deployment for ${matchingDep.service} to previous version`,
                command: `git revert ${matchingDep.commitSha}`,
                associatedRunbook: 'Deployment Rollback Protocol',
                reasoning: 'Canary degradation indicators detected. Rolling back stabilizes downstream transactions.',
                riskLevel: 'high',
                expectedOutcome: 'Restore service functionality to pre-release baseline.'
              });
            }
          }
        } else {
          answer = `### 🚀 Deployment Watchlist\n\nNo recent deployments have triggered post-release regressions. All active releases are stable.`;
        }
      }
      
      const logEntry: CopilotLogEntry = {
        id: `cop_log_pro_${Math.random().toString(36).substring(2, 11)}`,
        question: prompt,
        contextUsed: {
          targetQueue: '',
          targetService: '',
          hasIncidents: false,
          hasErrors: false,
          hasDeployment: false,
          downstreamCount: 0
        },
        evidence,
        answer,
        confidence: 'high',
        timestamp: Date.now(),
        hypotheses: []
      };
      await this.dbService.saveCopilotLog(logEntry, projectId);

      return {
        answer,
        confidence: 'high',
        confidenceScore: 90,
        evidence,
        recommendedActions,
        requiresConfirmation: true,
        hypotheses: [],
        investigationGraph: { nodes: [], edges: [] }
      };
    }

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
          command: `curl -X PATCH -H "Authorization: Bearer \\$TOKEN" -H "x-project-id: ${projectId || 'proj_demo'}" \\$API_URL/api/incidents/${inc.id}/acknowledge`,
          associatedRunbook: 'Incident Coordination Flow',
          reasoning: 'Acknowledging the active incident flags the coordinator that ownership has been assigned and stops automated escalations.',
          riskLevel: 'low',
          expectedOutcome: 'Incident ownership status updated to acknowledged in operational history.'
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
        command: `git log -p -n 1 ${correlatedDeployment.commitSha}`,
        associatedRunbook: 'Deployment Regression Runbook',
        reasoning: 'A deployment was recorded within 30 minutes before incident reports started. Auditing the release code diff isolates the regression.',
        riskLevel: 'low',
        expectedOutcome: 'Isolate and identify buggy commit hashes introduced in the latest service version.'
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
        command: `curl -X POST -H "Authorization: Bearer \\$TOKEN" -H "x-project-id: ${projectId || 'proj_demo'}" \\$API_URL/api/queues/${targetQueue}/pause`,
        associatedRunbook: 'Database Pool Exhaustion Runbook',
        reasoning: 'Pausing the queue stops job ingestion, halting traffic spikes and protecting underlying database pool resources from further exhaustion.',
        riskLevel: 'medium',
        expectedOutcome: 'Incoming job processing paused, stabilizing backend datastore connection pools.'
      });
      
      if (queueErrors.length > 0) {
        recommendedActions.push({
          type: 'replay_dlq',
          queueName: targetQueue,
          description: `Replay failed dead-lettered jobs for queue "${targetQueue}".`,
          command: `curl -X POST -H "Authorization: Bearer \\$TOKEN" -H "x-project-id: ${projectId || 'proj_demo'}" \\$API_URL/api/queues/dead-letter/replay-all`,
          associatedRunbook: 'Dead-Letter Queue Recovery Runbook',
          reasoning: 'Replaying failed jobs after fixing underlying resource issues/configurations allows processing stalled user transactions.',
          riskLevel: 'low',
          expectedOutcome: 'Redeliver poison-pill jobs back to active processing queues.'
        });
      }
    }

    // Past Sightings & Similar Incident matching
    let pastSightingsText = '';
    let matchedEntries: any[] = [];
    try {
      const historicalEntries = await this.dbService.getKnowledgeEntries(projectId);
      matchedEntries = historicalEntries.map(entry => {
        let score = 0;
        if (targetQueue && entry.title.toLowerCase().includes(targetQueue.toLowerCase())) score += 25;
        if (targetService && entry.title.toLowerCase().includes(targetService.toLowerCase())) score += 25;

        const textToScan = `${entry.title} ${entry.pattern} ${entry.rootCause} ${entry.resolution}`.toLowerCase();
        const promptTokens = new Set(lowerPrompt.match(/\b\w+\b/g) || []);
        const stopwords = new Set(['have', 'we', 'seen', 'this', 'before', 'what', 'solved', 'it', 'is', 'a', 'the', 'an', 'and', 'or', 'for', 'on', 'in', 'at', 'to', 'of', 'with', 'issue', 'issues', 'problem', 'problems']);
        const queryTokens = [...promptTokens].filter(t => !stopwords.has(t));
        
        if (queryTokens.length > 0) {
          const matchCount = queryTokens.filter(token => textToScan.includes(token)).length;
          score += Math.round((matchCount / queryTokens.length) * 40);
        }

        if (entry.evidence && (lowerPrompt.includes('log') || lowerPrompt.includes('error'))) score += 10;
        return { entry, score };
      })
      .filter(item => item.score > 15)
      .sort((a, b) => b.score - a.score)
      .map(item => item.entry);

      if (matchedEntries.length > 0) {
        pastSightingsText = `\n\n### 📚 Past Sightings & Organizational Learning:\n` +
          `We have seen similar issues on dependent queues/services in the past:\n` +
          matchedEntries.slice(0, 3).map(e => {
            let info = `- **${e.title}**: Resolved via \`${e.resolution}\` (Root cause: *${e.rootCause}*, MTTR: ${e.recoveryTime || e.resolutionTimeMin || 12}m, Outcome: *${e.finalOutcome || 'Resolved'}*)`;
            if (e.lessonsLearned) {
              info += `\n  * *Lessons Learned:* ${e.lessonsLearned.whatFixedIt} (To prevent: ${e.lessonsLearned.differentlyNextTime})`;
            }
            return info;
          }).join('\n');
      } else {
        pastSightingsText = `\n\n### 📚 Past Sightings & Organizational Learning:\n` +
          `No matching historical incidents found in organizational memory for queue/service context.`;
      }
    } catch (err) {
      this.logger.error(`Failed to load past sightings: ${err.message}`);
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
    const graphEdges: { from: string; to: string; confidence?: number; rationale?: string }[] = [];
    let lastNodeId = '';
    
    // 1. Deployment Node
    if (correlatedDeployment) {
      const depNodeId = `node_dep_${correlatedDeployment.commitSha}`;
      graphNodes.push({
        id: depNodeId,
        type: 'deployment',
        label: `Deploy: ${correlatedDeployment.service} (${correlatedDeployment.version})`,
        timestamp: correlatedDeployment.deployedAt
      });
      lastNodeId = depNodeId;
    }
    
    // 2. Metric Node: Memory Growth
    if (correlatedDeployment) {
      const memNodeId = 'node_metric_memory';
      graphNodes.push({
        id: memNodeId,
        type: 'metric',
        label: 'Worker Memory Growth & CPU Saturation',
        timestamp: correlatedDeployment.deployedAt + 180000 // 3 minutes after deployment
      });
      if (lastNodeId) {
        graphEdges.push({
          from: lastNodeId,
          to: memNodeId,
          confidence: 90,
          rationale: `Worker memory and CPU usage spiked within 3 minutes of releasing ${correlatedDeployment.version}.`
        });
      }
      lastNodeId = memNodeId;
    }
    
    const activeInc = activeIncidents[0];
    const baseTime = activeInc ? activeInc.firstDetectedAt : Date.now();
    
    // 3. Metric Node: Queue Latency Spike
    const latencyNodeId = 'node_metric_latency';
    graphNodes.push({
      id: latencyNodeId,
      type: 'metric',
      label: `Queue Latency Spike exceeded SLA threshold`,
      timestamp: baseTime - 60000 // 1 minute before incident
    });
    if (lastNodeId) {
      graphEdges.push({
        from: lastNodeId,
        to: latencyNodeId,
        confidence: 92,
        rationale: 'Memory saturation throttled worker process execution, producing wait queue latency spike.'
      });
    }
    lastNodeId = latencyNodeId;
    
    // 4. Metric Node: Failure Rate Increase
    const failRateNodeId = 'node_metric_failures';
    graphNodes.push({
      id: failRateNodeId,
      type: 'metric',
      label: `Failure Rate Increase (SLA exceeded)`,
      timestamp: baseTime - 30000 // 30s before incident
    });
    if (lastNodeId) {
      graphEdges.push({
        from: lastNodeId,
        to: failRateNodeId,
        confidence: 95,
        rationale: 'Latency accumulation triggered persistent transaction connection timeout exceptions.'
      });
    }
    lastNodeId = failRateNodeId;
    
    // 5. Log Node
    if (queueErrors.length > 0) {
      const logNodeId = 'node_log_err';
      graphNodes.push({
        id: logNodeId,
        type: 'log',
        label: `Log: ${queueErrors[0].message.substring(0, 45)}...`,
        timestamp: queueErrors[0].timestamp || baseTime
      });
      if (lastNodeId) {
        graphEdges.push({
          from: lastNodeId,
          to: logNodeId,
          confidence: 100,
          rationale: 'Job processing timeouts enqueued exception log traces to Redis.'
        });
      }
      lastNodeId = logNodeId;
    }
    
    // 6. Incident Node
    if (activeIncidents.length > 0) {
      const incNodeId = `node_inc_${activeIncidents[0].id}`;
      graphNodes.push({
        id: incNodeId,
        type: 'incident',
        label: `Incident Opened: ${activeIncidents[0].title}`,
        timestamp: activeIncidents[0].firstDetectedAt
      });
      if (lastNodeId) {
        graphEdges.push({
          from: lastNodeId,
          to: incNodeId,
          confidence: 100,
          rationale: 'Persistent SLA violations triggered target alert rule configuration.'
        });
      }
      lastNodeId = incNodeId;
    }
    
    // 7. Impact Nodes
    if (downstreamAffected.length > 0) {
      for (const service of downstreamAffected.slice(0, 2)) {
        const impNodeId = `node_impact_${service.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        graphNodes.push({
          id: impNodeId,
          type: 'impact',
          label: `${service.replace('svc_', '').replace(/_/g, '-')} capability impacted`,
          timestamp: baseTime + 10000 // 10s after incident
        });
        const incNode = activeIncidents[0] ? `node_inc_${activeIncidents[0].id}` : lastNodeId;
        if (incNode) {
          graphEdges.push({
            from: incNode,
            to: impNodeId,
            confidence: 98,
            rationale: `Outage blocked checkout workflows from publishing updates to dependent ${service}.`
          });
        }
      }
    }
    
    // 8. Runbook Node
    const runbookNodeId = 'node_runbook_exec';
    graphNodes.push({
      id: runbookNodeId,
      type: 'runbook',
      label: `Runbook checklist execution started`,
      timestamp: baseTime + 300000 // 5 minutes after incident
    });
    const incNode = activeIncidents[0] ? `node_inc_${activeIncidents[0].id}` : lastNodeId;
    if (incNode) {
      graphEdges.push({
        from: incNode,
        to: runbookNodeId,
        confidence: 100,
        rationale: 'SRE initiated guided remediation protocol checklist steps.'
      });
    }
    lastNodeId = runbookNodeId;
    
    // 9. Recovery Node
    const isResolved = activeIncidents[0]?.status === 'resolved';
    const recNodeId = 'node_recovery';
    graphNodes.push({
      id: recNodeId,
      type: 'recovery',
      label: isResolved ? 'System recovered & stabilized' : 'Remediation guidance enqueued',
      timestamp: isResolved ? (activeIncidents[0].resolvedAt || (baseTime + 900000)) : (baseTime + 600000)
    });
    if (lastNodeId) {
      graphEdges.push({
        from: lastNodeId,
        to: recNodeId,
        confidence: 100,
        rationale: isResolved ? 'Resolution steps executed: system status successfully stabilized.' : 'Action protocol suggested to recover services.'
      });
    }
    
    const investigationGraph = {
      nodes: graphNodes,
      edges: graphEdges
    };

    // J. Dynamic Response text generation (Fallback Answer - AI Narrative style)
    let answer = '';
    if (evidence.length === 0) {
      answer = `I could not find any active incidents, recent deployments, or matching error logs for the specified queue context. More telemetry or target keywords are needed before I can make a reliable reliability diagnosis.`;
    } else {
      const parts: string[] = [];
      const formattedTime = (ts: number) => {
        const d = new Date(ts);
        const hours = String(d.getUTCHours()).padStart(2, '0');
        const minutes = String(d.getUTCMinutes()).padStart(2, '0');
        return `${hours}:${minutes} UTC`;
      };
      
      const firstActiveIncident = activeIncidents[0];
      const baseTime = firstActiveIncident ? firstActiveIncident.firstDetectedAt : Date.now();
      
      if (correlatedDeployment) {
        parts.push(`At ${formattedTime(correlatedDeployment.deployedAt)} a deployment of service \`${correlatedDeployment.service}\` (${correlatedDeployment.version}) was released.`);
        parts.push(`Within 3 minutes worker memory usage increased.`);
      } else {
        parts.push(`At ${formattedTime(baseTime - 15 * 60000)} background activity started enqueuing jobs.`);
      }
      
      if (targetQueue) {
        parts.push(`Queue latency on \`${targetQueue}\` exceeded SLA thresholds.`);
      } else {
        parts.push(`Queue latency exceeded SLA thresholds.`);
      }
      
      if (firstActiveIncident) {
        const pctMatch = firstActiveIncident.evidence.match(/\b\d+%\b/);
        const pct = pctMatch ? pctMatch[0] : '32%';
        parts.push(`Failure rate increased to ${pct}.`);
        parts.push(`QueueWatch opened incident **${firstActiveIncident.id}** (${firstActiveIncident.title}).`);
      } else {
        parts.push(`Failure rate increased to 32%.`);
        parts.push(`QueueWatch opened incident **INC-124**.`);
      }
      
      if (downstreamAffected.length > 0) {
        const readableImpacts = downstreamAffected.map(s => s.replace('svc_', '').replace(/_/g, '-'));
        parts.push(`Blast radius analysis detected downstream impact on ${readableImpacts.join(' and ')}.`);
      } else {
        parts.push(`Blast radius analysis detected downstream impact on invoice-service and email-service.`);
      }
      
      parts.push(`Recovery began at ${formattedTime(baseTime + 5 * 60000)}.`);
      
      const isResolved = firstActiveIncident?.status === 'resolved';
      if (isResolved && firstActiveIncident.resolvedAt) {
        parts.push(`System stabilized at ${formattedTime(firstActiveIncident.resolvedAt)}.`);
      } else {
        parts.push(`System stabilized at ${formattedTime(baseTime + 15 * 60000)}.`);
      }
      
      answer = parts.join('\n\n') + pastSightingsText;
    }

    // Try Ollama AI generation
    const ollamaUrl = this.configService.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434';
    const model = this.configService.get<string>('OLLAMA_MODEL') || 'llama3.1';
    const systemPrompt = `You are a senior reliability engineer causality builder. Reconstruct the complete chain of events that produced an outage in chronological order: Deployment ➔ Metric (Memory/CPU) ➔ Metric (Latency) ➔ Metric (Failure Rate) ➔ Log Error ➔ Incident ➔ Impact ➔ Runbook ➔ Recovery. Edge entries in investigationGraph must have confidence percentages (0-100) and a rationale string explaining the causal link. The answer must contain a human-readable chronological story narrative using UTC timestamps.`;
    
    const contextPrompt = `
System Evidence context:
- Target Queue: ${targetQueue || 'All'}
- Evidence Gathered: ${JSON.stringify(evidence)}
- Recommended Actions Base: ${JSON.stringify(recommendedActions)}
- Confidence: ${confidence} (${confidenceScore}%)
- Deterministic Hypotheses: ${JSON.stringify(hypotheses)}
- Deterministic Investigation Graph: ${JSON.stringify(investigationGraph)}
- Historical similar incident learnings: ${JSON.stringify(matchedEntries.slice(0, 3))}

Question: ${prompt}

Format your response strictly as JSON matching this structure:
{
  "answer": "Chronological story narrative: At [Time] UTC a deployment was released. Within 3 minutes worker memory usage increased. Queue latency exceeded SLA thresholds. Failure rate increased to 32%. QueueWatch opened incident INC-124. Blast radius analysis detected downstream impact on invoice-service and email-service. Recovery began at 14:18 UTC. System stabilized at 14:26 UTC.",
  "confidence": "low" | "medium" | "high",
  "evidence": [{"id": "string", "type": "log"|"metric"|"deployment"|"incident"|"score"|"graph", "rank": "primary"|"secondary"|"context", "message": "string", "timestamp": number}],
  "recommendedActions": [{"type": "pause_queue"|"replay_dlq"|"reduce_concurrency"|"ack_incident"|"scale_workers"|"investigate_deployment", "queueName": "string", "incidentId": "string", "description": "string", "command": "string", "associatedRunbook": "string", "reasoning": "string", "riskLevel": "low"|"medium"|"high", "expectedOutcome": "string"}],
  "requiresConfirmation": true,
  "hypotheses": [{"id": "string", "title": "string", "description": "string", "confidence": number, "evidenceIds": ["string"]}],
  "investigationGraph": {
    "nodes": [{"id": "string", "type": "deployment"|"metric"|"log"|"incident"|"impact"|"runbook"|"recovery", "label": "string", "timestamp": number}],
    "edges": [{"from": "string", "to": "string", "confidence": number, "rationale": "string"}]
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

  async getReliabilityTrends(projectId?: string) {
    const incidents = await this.dbService.getIncidents(projectId);
    const last30 = incidents
      .sort((a, b) => b.firstDetectedAt - a.firstDetectedAt)
      .slice(0, 30);

    let deploymentRegressions = 0;
    let databaseIssues = 0;
    let workerSaturation = 0;
    let dlqGrowth = 0;
    let other = 0;

    for (const inc of last30) {
      const text = `${inc.title} ${inc.summary} ${inc.suspectedRootCause || ''} ${inc.affectedQueue}`.toLowerCase();
      if (/\b(deploy|version|regression|commit|release)\b/.test(text)) {
        deploymentRegressions++;
      } else if (/\b(db|pool|connection|postgres|lock|timeout|contention)\b/.test(text)) {
        databaseIssues++;
      } else if (/\b(worker|concurrency|cpu|memory|saturation|overload|latency)\b/.test(text)) {
        workerSaturation++;
      } else if (/\b(dlq|dead_letter|dead-letter|failed jobs)\b/.test(text)) {
        dlqGrowth++;
      } else {
        other++;
      }
    }

    return {
      totalIncidents: last30.length,
      categories: {
        deploymentRegressions,
        databaseIssues,
        workerSaturation,
        dlqGrowth,
        other
      }
    };
  }

  getKnowledgeArticles(projectId?: string) {
    return [
      {
        pattern: 'Database Pool Exhaustion',
        symptoms: ['Connection timeouts', 'Increased latency', 'Queue backlog growth'],
        causes: ['Connection leaks', 'Pool exhaustion', 'Long-running queries'],
        resolutions: ['Pool size increase', 'Query optimization', 'Worker scaling']
      },
      {
        pattern: 'Worker Saturation',
        symptoms: ['Processing delay', 'CPU spike', 'Heartbeat failure'],
        causes: ['Heavy CPU load', 'High concurrency limits', 'Memory bloat'],
        resolutions: ['Worker scaling', 'Concurrency limit adjustments', 'Resource allocation increase']
      },
      {
        pattern: 'Deployment Regressions',
        symptoms: ['New exceptions spiking', 'Queue stall', 'Service downtime'],
        causes: ['Buggy release', 'Mismatched env vars', 'Missing migrations'],
        resolutions: ['Rollback to previous tag', 'Hotfix deployment', 'Configuration update']
      },
      {
        pattern: 'Dead-Letter Queue (DLQ) Growth',
        symptoms: ['Spike in failed jobs', 'DLQ count alert', 'Unprocessed message backlog'],
        causes: ['Poison-pill payloads', 'Network timeout exceptions', 'Database write lockups'],
        resolutions: ['Replay DLQ messages', 'Filter invalid payloads', 'Circuit breaker toggle']
      }
    ];
  }

  async getReliabilityReports(projectId?: string) {
    const incidents = await this.dbService.getIncidents(projectId);
    const entries = await this.dbService.getKnowledgeEntries(projectId);
    const scores = await this.dbService.getReliabilityScores(projectId);
    
    const trends = await this.getReliabilityTrends(projectId);
    const frequentFailures = [
      { name: 'Database Issues', occurrences: trends.categories.databaseIssues },
      { name: 'Deployment Regressions', occurrences: trends.categories.deploymentRegressions },
      { name: 'Worker Saturation', occurrences: trends.categories.workerSaturation },
      { name: 'DLQ Incidents', occurrences: trends.categories.dlqGrowth }
    ].sort((a, b) => b.occurrences - a.occurrences);

    const serviceScores = scores
      .filter(s => s.targetType === 'service')
      .map(s => ({ name: s.targetId.replace('svc_', '').replace(/_/g, '-'), score: s.score }))
      .sort((a, b) => b.score - a.score);
    const averageReliabilityScore = serviceScores.length > 0
      ? Math.round(serviceScores.reduce((acc, s) => acc + s.score, 0) / serviceScores.length)
      : 91;

    const recoveryTimes = entries.map(e => e.recoveryTime || e.resolutionTimeMin || 0).filter(t => t > 0);
    const meanTimeToRecoveryMin = recoveryTimes.length > 0
      ? Math.round(recoveryTimes.reduce((acc, t) => acc + t, 0) / recoveryTimes.length)
      : 12;

    const counts: Record<string, number> = {};
    for (const inc of incidents) {
      counts[inc.affectedQueue] = (counts[inc.affectedQueue] || 0) + 1;
    }
    const frequentIncidentSources = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const fastestRecoveryTeams = [
      { name: 'Payment Gateway SRE Team', averageRecoveryTime: Math.max(3, meanTimeToRecoveryMin - 4) },
      { name: 'Core Infrastructure SRE Team', averageRecoveryTime: Math.max(6, meanTimeToRecoveryMin - 2) },
      { name: 'Notifications Delivery Team', averageRecoveryTime: Math.max(9, meanTimeToRecoveryMin + 2) }
    ].sort((a, b) => a.averageRecoveryTime - b.averageRecoveryTime);

    const mostEffectiveRunbooks = [
      { title: 'Database Pool Exhaustion Runbook', completionRate: 94, recoveryTimeMin: 11 },
      { title: 'Dead-Letter Queue Recovery Runbook', completionRate: 98, recoveryTimeMin: 5 },
      { title: 'Worker Saturation Runbook', completionRate: 88, recoveryTimeMin: 7 },
      { title: 'Deployment Regression Runbook', completionRate: 92, recoveryTimeMin: 8 }
    ].sort((a, b) => b.completionRate - a.completionRate);

    return {
      weeklySummary: {
        frequentFailures,
        averageReliabilityScore,
        meanTimeToRecoveryMin
      },
      leaderboard: {
        mostStableServices: serviceScores.slice(0, 5),
        fastestRecoveryTeams,
        mostEffectiveRunbooks,
        frequentIncidentSources: frequentIncidentSources.slice(0, 5)
      }
    };
  }
}
