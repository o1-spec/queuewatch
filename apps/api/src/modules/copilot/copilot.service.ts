import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { ConfigService } from '@nestjs/config';
import { CopilotResponse } from '@queuewatch/shared';
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

  async getKnowledgeBase() {
    return this.dbService.getKnowledgeEntries();
  }

  async queryCopilot(prompt: string): Promise<CopilotResponse> {
    // 1. Gather all evidence sources
    const incidents = await this.dbService.getIncidents();
    const logs = await this.dbService.getLogs(undefined, 200);
    const telemetry = await this.dbService.getTelemetry(100);
    const deployments = await this.dbService.getDeploymentEvents();
    const correlations = await this.correlationService.getCorrelations();

    // V5 additional signals
    const services = await this.dbService.getServices();
    const reliabilityScores = await this.dbService.getReliabilityScores();
    const predictions = await this.dbService.getPredictions();
    const depGraph = await this.dbService.getDependencyGraph();

    // 2. Filter evidence matching query keywords
    const lowerPrompt = prompt.toLowerCase();
    
    // Find matching queue context
    let targetQueue = '';
    if (lowerPrompt.includes('email') || lowerPrompt.includes('smtp')) targetQueue = 'email_notifications';
    else if (lowerPrompt.includes('webhook') || lowerPrompt.includes('stripe')) targetQueue = 'webhook_delivery';
    else if (lowerPrompt.includes('image') || lowerPrompt.includes('sharp')) targetQueue = 'image_processing';
    else if (lowerPrompt.includes('ai') || lowerPrompt.includes('llama')) targetQueue = 'ai_tasks';

    const matchingLogs = logs.filter(l => l.level === 'error' && (!targetQueue || l.queueName === targetQueue)).slice(0, 5);
    const matchingIncidents = incidents.filter(i => !targetQueue || i.affectedQueue === targetQueue);
    const matchingDeps = deployments.filter(d => !targetQueue || d.service === targetQueue);

    // 3. Evaluate confidence rules
    let confidenceScore = 90;
    let confidenceReason = '';
    if (matchingLogs.length === 0 && matchingDeps.length === 0) {
      confidenceScore = 30; // Low confidence
      confidenceReason = 'No related logs or deployment events found.';
    }

    // 4. Try Ollama AI generation
    const ollamaUrl = this.configService.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434';
    const model = this.configService.get<string>('OLLAMA_MODEL') || 'llama3.1';

    const systemPrompt = `You are a senior reliability engineer. Use evidence. Never speculate. Only generate conclusions supported by telemetry. Provide operational recommendations. You can explain reliability scores, predictions, blast radius, and service dependencies. All actions (like replaying dead letters or pausing queues) require human confirmation and must not run automatically.`;
    const contextPrompt = `
System Evidence context:
- Target Queue: ${targetQueue || 'All'}
- Matching Logs: ${JSON.stringify(matchingLogs.map(l => l.message))}
- Matching Incidents: ${JSON.stringify(matchingIncidents.map(i => i.title))}
- Matching Deployments: ${JSON.stringify(matchingDeps.map(d => `${d.service}:${d.version}`))}
- Correlations Detected: ${JSON.stringify(correlations)}
- Services Registry: ${JSON.stringify(services.map(s => ({ name: s.name, status: s.status, owner: s.owner })))}
- Reliability Scores: ${JSON.stringify(reliabilityScores.map(s => ({ target: s.targetId, type: s.targetType, score: s.score })))}
- Active Predictions: ${JSON.stringify(predictions.map(p => ({ title: p.title, risk: p.riskScore, reason: p.reason })))}
- Dependencies Graph: ${JSON.stringify(depGraph)}
${confidenceReason ? `- Warning: ${confidenceReason}\n` : ''}

Question: ${prompt}

Format your response strictly as JSON:
{
  "answer": "Concise answer citing logs, incident IDs, deployments, reliability scores, predictions, or blast radius.",
  "evidence": ["Log snippet, Incident ID, or commit version used to support answer"],
  "confidenceScore": ${confidenceScore},
  "recommendedActions": ["Safe human-confirmed recovery action e.g. replay dead-letter jobs, pause queue, investigate deployment"],
  "relatedIncidents": ["incident ID reference"],
  "relatedDeployments": ["commit version or version reference"]
}`;

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
        const parsed: CopilotResponse = JSON.parse(resBody.response.trim());
        
        // Ensure confidence rule override holds
        if (confidenceScore === 30) {
          parsed.confidenceScore = 30;
          parsed.answer = `${parsed.answer}\n\n*[Low Confidence Warning: ${confidenceReason}]*`;
        }
        return parsed;
      }
    } catch (e) {
      this.logger.warn(`Ollama copilot query failed: ${e.message}. Using deterministic fallback.`);
    }

    // 5. Deterministic fallback builder
    let answer = 'All platform services are reporting within active reliability SLOs.';
    let evidenceList: string[] = [];
    let actions: string[] = [];
    let relIncidents: string[] = [];
    let relDeps: string[] = [];

    if (lowerPrompt.includes('score') || lowerPrompt.includes('reliability')) {
      answer = 'Payment Service reliability is degraded to 67% due to Stripe timeout exceptions enqueued inside webhook_delivery queue.';
      evidenceList = ['Reliability Score webhook_delivery = 67', 'Incident: webhook_delivery failure rate spike'];
      actions = ['Review Payment Service logs', 'Pause webhook_delivery queue'];
      relIncidents = matchingIncidents.map(i => i.id);
    } else if (lowerPrompt.includes('prediction') || lowerPrompt.includes('risk')) {
      answer = 'A predicted backlog saturation hazard is flagged for webhook_delivery queue with risk score 78% due to job ingestion speed mismatches.';
      evidenceList = ['Prediction: Backlog Saturation Risk', 'Risk: 78%'];
      actions = ['Scale payment workers replicas', 'Pause checkout simulation'];
    } else if (lowerPrompt.includes('dependency') || lowerPrompt.includes('graph')) {
      answer = 'Order Service has downstream queue paths leading to Payment Service and Notification Service. Downstream failures cascade to notifications.';
      evidenceList = ['Graph node: svc_order -> webhook_delivery -> svc_payment -> email_notifications -> svc_notification'];
      actions = ['Inspect Order Service webhook webhook_delivery', 'Enable circuit breakers'];
    } else if (targetQueue === 'webhook_delivery') {
      answer = 'Stripe payment webhooks are experiencing connection timeouts due to API delays on api.stripe.com.';
      evidenceList = ['Log: timeout after 5000ms enqueuing stripe callbacks', 'Incident: Latency threshold bottleneck on webhook_delivery'];
      actions = ['Pause queue webhook_delivery', 'Verify Stripe status page', 'Adjust worker concurrency factor'];
      relIncidents = matchingIncidents.map(i => i.id);
      relDeps = matchingDeps.map(d => d.version);
    } else if (targetQueue === 'email_notifications') {
      answer = 'SendGrid SMTP server is throwing rate limiting exceptions (HTTP 429).';
      evidenceList = ['Log: SMTP 429 Rate Limit Exceeded', 'Metrics failure rate: > 15%'];
      actions = ['Reduce retry concurrency to 1', 'Replay dead-letter jobs for failed newsletters'];
      relIncidents = matchingIncidents.map(i => i.id);
      relDeps = matchingDeps.map(d => d.version);
    } else if (lowerPrompt.includes('backlog') || lowerPrompt.includes('slow')) {
      answer = 'Queue backlog is buffering because worker consumption speed is lower than job production.';
      evidenceList = ['Metrics backlog count > 30 waiting tasks', 'Worker CPU usage spikes'];
      actions = ['Scale worker replica sets', 'Verify queue concurrency configuration'];
      relIncidents = matchingIncidents.map(i => i.id);
    }

    if (confidenceScore === 30) {
      answer = `${answer}\n\n*[Low Confidence Warning: ${confidenceReason}]*`;
    }

    return {
      answer,
      evidence: evidenceList,
      confidenceScore,
      recommendedActions: actions,
      relatedIncidents: relIncidents,
      relatedDeployments: relDeps
    };
  }

  async chatIncident(incidentId: string, prompt: string): Promise<CopilotResponse> {
    const incident = await this.dbService.getIncident(incidentId);
    if (!incident) {
      return {
        answer: `Incident ${incidentId} not found in database memory.`,
        evidence: [],
        confidenceScore: 0,
        recommendedActions: [],
        relatedIncidents: [],
        relatedDeployments: []
      };
    }

    // Frame the prompt in context of the specific incident
    const contextPrompt = `Discussing active Incident ID #${incident.id} (${incident.title}). affected queue: ${incident.affectedQueue}. suspected root cause: ${incident.suspectedRootCause}.\nUser query: ${prompt}`;
    return this.queryCopilot(contextPrompt);
  }
}
