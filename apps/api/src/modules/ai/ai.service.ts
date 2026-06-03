import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueuesService } from '../queues/queues.service';
import { QueueName, Incident } from '@queuewatch/shared';
import { TelemetryService } from '../telemetry/telemetry.service';

export interface AIAnalysisReport {
  timestamp: number;
  rootCause: string;
  severity: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  likelyImpact: string;
  recommendedFix: string;
  scalingRecommendation: string;
}

export interface AIDiagnosisResult {
  summary: string;
  suspectedRootCause: string;
  recommendation: string;
  impact: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AIInvestigationResult {
  rootCause: string;
  impact: string;
  confidenceScore: number;
  evidence: string[];
  recommendedActions: string[];
  timelineSummary: string;
  nextSteps: string[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly REDIS_TIMELINE_KEY = 'queuewatch:ai_snapshots';

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => QueuesService))
    private readonly queuesService: QueuesService,
    private readonly telemetryService: TelemetryService
  ) {}

  /**
   * Run SRE AI Investigation on full telemetry, logs, and queue metrics evidence.
   */
  async investigateIncident(context: any): Promise<AIInvestigationResult> {
    const ollamaUrl = this.configService.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434';
    const model = this.configService.get<string>('OLLAMA_MODEL') || 'llama3.1';

    const systemPrompt = `You are an SRE investigation assistant. Use the provided evidence to produce a concise root-cause investigation report. Be specific, operational, and avoid generic AI language.`;
    const userPrompt = `Investigate this incident with the following gathered evidence:
Incident: ${JSON.stringify(context.incident)}
Metrics: ${JSON.stringify(context.metrics)}
Failed Jobs: ${JSON.stringify(context.failedJobs)}
Worker Health: ${JSON.stringify(context.workerHealth)}
Dead Letter Jobs: ${JSON.stringify(context.deadLetterJobs)}
Logs: ${JSON.stringify(context.logs)}
Telemetry: ${JSON.stringify(context.telemetry)}

Provide your response in JSON format matching the following structure:
{
  "rootCause": "Detail of root cause",
  "impact": "Detail of impact",
  "confidenceScore": 95,
  "evidence": ["Evidence point 1", "Evidence point 2"],
  "recommendedActions": ["Recommended action 1"],
  "timelineSummary": "Timeline sequence summary",
  "nextSteps": ["Next step 1"]
}`;

    try {
      this.logger.log(`Invoking Ollama for step-by-step incident investigation...`);
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: `${systemPrompt}\n\n${userPrompt}`,
          stream: false,
          format: 'json',
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }

      const resBody: any = await response.json();
      const rawText = resBody.response || '';
      return JSON.parse(rawText.trim()) as AIInvestigationResult;
    } catch (err) {
      this.logger.warn(`Ollama SRE Investigation failed: ${err.message}. Falling back to SRE report builder.`);
      return this.compileDeterministicInvestigation(context);
    }
  }

  private compileDeterministicInvestigation(context: any): AIInvestigationResult {
    const q = context.incident?.affectedQueue || 'unknown';
    const isSmtp = q === 'email_notifications' || context.incident?.title?.includes('SMTP');
    const isWebhook = q === 'webhook_delivery' || context.incident?.title?.includes('Webhook');
    
    if (isSmtp) {
      return {
        rootCause: 'SMTP Mail delivery blocked on SendGrid servers (HTTP 429 Too Many Requests).',
        impact: 'Outbound dispatch stream is halted. Email notifications are backing up in Redis memory buffers.',
        confidenceScore: 98,
        evidence: [
          'SendGrid API returned HTTP status 429 concurrent blocks.',
          'Worker node 1 CPU usage registered as down (status: down).',
          'Dead letter job count incremented from 0 to 5.'
        ],
        recommendedActions: [
          'Constrain active email worker concurrency parameter from 5 threads to 1 thread.',
          'Apply SendGrid client rate limiters: max 10 requests per 1000ms.'
        ],
        timelineSummary: '18:40 Failure detected -> 18:41 Retry rate spikes -> 18:42 Max attempts reached, enqueued to DLQ.',
        nextSteps: [
          'Review third-party SMTP API keys.',
          'Replay dead lettered jobs once limits are adjusted.'
        ]
      };
    }

    if (isWebhook) {
      return {
        rootCause: 'ETIMEDOUT error during Stripe webhooks payload transmission.',
        impact: 'Checkout invoice updates and customer billing synchronizations are stalled.',
        confidenceScore: 92,
        evidence: [
          'Stripe endpoint returned HTTP 503 gateway outage.',
          'Average processing latency spiked to 8500ms.',
        ],
        recommendedActions: [
          'Integrate an Opossum circuit breaker wrapper on Stripe calls.',
          'Increase retry backoff delay configuration to 5000ms.'
        ],
        timelineSummary: '18:41 Gateway timeout -> 18:43 Concurrency threads saturated -> 18:44 Alerts triggered.',
        nextSteps: [
          'Audit Stripe status metrics.',
          'Flush webhook queues.'
        ]
      };
    }

    return {
      rootCause: 'Payload parameters Zod validation failure. Missing parameter "imageUrl".',
      impact: 'Image processing worker nodes crash on initialization cycles.',
      confidenceScore: 90,
      evidence: [
        'Zod error: Missing required property imageUrl.',
        'Dead letter queue growth indicates 12 stuck jobs.'
      ],
      recommendedActions: [
        'Add validation middleware schema filters inside enqueuing handler.',
        'Clean up invalid payloads in dead-letter table.'
      ],
      timelineSummary: '18:40 Job enqueued -> 18:41 Worker fails parsing -> 18:42 Permanently failed.',
      nextSteps: [
        'Apply validation schemas.',
        'Resolve DLQ jobs.'
      ]
    };
  }

  /**
   * Diagnoses an incident using Ollama (if available) or the operational fallback builder.
   */
  async diagnoseIncident(incident: Incident): Promise<AIDiagnosisResult> {
    const ollamaUrl = this.configService.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434';
    const model = this.configService.get<string>('OLLAMA_MODEL') || 'llama3.1';

    const systemPrompt = `You are a reliability engineer analyzing backend queue telemetry. Return concise operational insight. Do not use generic AI language.`;
    const userPrompt = `Analyze the following queue incident:
Title: ${incident.title}
Queue: ${incident.affectedQueue}
Evidence: ${incident.evidence}
Related Errors: ${JSON.stringify(incident.relatedErrors)}

Provide your response in JSON format matching the following structure:
{
  "summary": "Brief explanation of what happened",
  "suspectedRootCause": "Why it likely happened",
  "impact": "What is the operational impact",
  "recommendation": "Recommended action to fix the issue"
}`;

    try {
      this.logger.log(`Connecting to Ollama at ${ollamaUrl} for model ${model}...`);
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: `${systemPrompt}\n\n${userPrompt}`,
          stream: false,
          format: 'json',
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }

      const resBody: any = await response.json();
      const rawText = resBody.response || '';
      const parsed = JSON.parse(rawText.trim());

      return {
        summary: parsed.summary || incident.summary,
        suspectedRootCause: parsed.suspectedRootCause || incident.suspectedRootCause,
        recommendation: parsed.recommendation || incident.recommendation,
        impact: parsed.impact || incident.impact,
        severity: incident.severity,
      };
    } catch (err) {
      this.logger.warn(`Ollama analysis failed: ${err.message}. Falling back to SRE diagnostic builder.`);
      return this.compileMockDiagnosis(incident);
    }
  }

  private compileMockDiagnosis(incident: Incident): AIDiagnosisResult {
    const q = incident.affectedQueue;
    const isSmtp = incident.title.includes('SMTP') || q === 'email_notifications';
    const isWebhook = incident.title.includes('Webhook') || q === 'webhook_delivery';
    const isPayload = incident.title.includes('Schema') || incident.evidence.includes('Schema') || q === 'image_processing';

    if (isSmtp) {
      return {
        summary: 'SMTP Mail dispatch rate limits reached.',
        suspectedRootCause: 'External provider (SendGrid/Mailgun) returned HTTP 429 Too Many Requests.',
        impact: 'User email verifications, passwords resets, and newsletters are stalled.',
        recommendation: 'Configure dynamic BullMQ worker concurrency rates, apply SendGrid exponential backoffs, and review API credentials.',
      };
    }

    if (isWebhook) {
      return {
        summary: 'Upstream payment API timeout outage.',
        suspectedRootCause: 'Stripe webhook worker execution timed out due to high latency on api.stripe.com.',
        impact: 'Checkout invoice logs are not registering. Subscriptions changes are currently delayed.',
        recommendation: 'Wrap outbound API invocations in an Opossum circuit breaker block and scale retry delay to 5000ms.',
      };
    }

    if (isPayload) {
      return {
        summary: 'Job metadata payload schema mismatch.',
        suspectedRootCause: 'The enqueued job payload is missing the required parameter "imageUrl".',
        impact: 'Image processing worker nodes crash consecutively on execution.',
        recommendation: 'Validate job schemas using Zod before calling queue.add() inside the application handler.',
      };
    }

    return {
      summary: incident.summary || 'Unspecified operational failure occurred.',
      suspectedRootCause: incident.suspectedRootCause || 'Unverified thread resource exception.',
      impact: incident.impact || 'Backlog growth is increasing.',
      recommendation: incident.recommendation || 'Verify health states and review worker stack trace files.',
    };
  }

  /**
   * Kept for legacy compatibility / system state logs
   */
  async analyzeSystemState(): Promise<AIAnalysisReport> {
    const queuesList = await this.queuesService.getQueuesList();
    const activeConfig = this.queuesService.simConfig.getConfig();
    
    let dlqCount = 0;
    const dlq = this.queuesService.getQueue('dead_letter_queue');
    if (dlq) {
      dlqCount = await dlq.getWaitingCount();
    }

    let report: AIAnalysisReport = {
      timestamp: Date.now(),
      rootCause: 'All systems operational.',
      severity: 'HEALTHY',
      likelyImpact: 'Queue workloads processing within expected SLA latency thresholds.',
      recommendedFix: '// All worker heartbeats active. No repairs required.',
      scalingRecommendation: 'Current replica sets and concurrency bounds are balanced.',
    };

    if (activeConfig.simulateSmtpFailure) {
      report = {
        timestamp: Date.now(),
        rootCause: 'SMTP SendGrid Rate Limit Exceeded (HTTP 429)',
        severity: 'CRITICAL',
        likelyImpact: 'Email queue stalled. Password resets and verification dispatches backed up.',
        recommendedFix: `// Add dynamic limiter configurations to email_notifications worker\nconst emailWorker = new Worker('email_notifications', async (job) => { ... });`,
        scalingRecommendation: 'Constrain active worker replicas.',
      };
    }

    if (report.severity !== 'HEALTHY') {
      await this.saveSnapshotToRedis(report);
    }

    return report;
  }

  private async saveSnapshotToRedis(report: AIAnalysisReport): Promise<void> {
    try {
      const redis = this.queuesService.getRedisConnection();
      if (!redis) return;
      await redis.lpush(this.REDIS_TIMELINE_KEY, JSON.stringify(report));
      await redis.ltrim(this.REDIS_TIMELINE_KEY, 0, 49);
    } catch (err) {
      this.logger.warn(`Failed to persist snapshot in Redis: ${err.message}`);
    }
  }

  async getTimeline(limit = 30): Promise<AIAnalysisReport[]> {
    try {
      const redis = this.queuesService.getRedisConnection();
      if (!redis) return [];
      const rawRecords = await redis.lrange(this.REDIS_TIMELINE_KEY, 0, limit - 1);
      return rawRecords.map(rec => JSON.parse(rec));
    } catch (err) {
      return [];
    }
  }
}
