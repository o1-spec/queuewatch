import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueuesService } from '../queues/queues.service';
import { QueueName } from '@queuewatch/shared';

export interface AIAnalysisReport {
  timestamp: number;
  rootCause: string;
  severity: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  likelyImpact: string;
  recommendedFix: string;
  scalingRecommendation: string;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly REDIS_TIMELINE_KEY = 'queuewatch:ai_snapshots';

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => QueuesService))
    private readonly queuesService: QueuesService
  ) {}

  /**
   * Evaluates the current state of queues, workers, and simulators to construct the AI report.
   * If a GEMINI_API_KEY environment variable is defined, it hits the official Gemini API.
   * Otherwise, it uses the highly operational mock analysis engine.
   */
  async analyzeSystemState(): Promise<AIAnalysisReport> {
    this.logger.log('Initiating AI observability analysis audit...');

    // 1. Gather active metrics context
    const queuesList = await this.queuesService.getQueuesList();
    const activeConfig = this.queuesService.simConfig.getConfig();
    
    // Get DLQ count
    let dlqCount = 0;
    const dlq = this.queuesService.getQueue('dead_letter_queue');
    if (dlq) {
      dlqCount = await dlq.getWaitingCount();
    }

    const systemContext = {
      queues: queuesList.map(q => ({
        name: q.name,
        waiting: q.waiting,
        active: q.active,
        completed: q.completed,
        failed: q.failed,
        delayed: q.delayed,
        paused: q.paused,
      })),
      dlqCount,
      simulators: activeConfig,
    };

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    let report: AIAnalysisReport;

    if (apiKey) {
      try {
        report = await this.callGeminiAPI(apiKey, systemContext);
      } catch (err) {
        this.logger.warn(`Gemini API connection failed: ${err.message}. Falling back to operational mock engine.`);
        report = this.compileMockAnalysis(systemContext);
      }
    } else {
      this.logger.log('No GEMINI_API_KEY environment key detected. Standard dynamic mock fallback active.');
      report = this.compileMockAnalysis(systemContext);
    }

    // 2. Persist snapshots with critical/warning severities in our Redis-native incident chronology timeline
    if (report.severity !== 'HEALTHY') {
      await this.saveSnapshotToRedis(report);
    }

    return report;
  }

  /**
   * Retrieves the historical chronology list of AI snapshots from Redis memory blocks.
   */
  async getTimeline(limit = 30): Promise<AIAnalysisReport[]> {
    try {
      const redis = this.queuesService.getRedisConnection();
      if (!redis) {
        return [];
      }
      
      const rawRecords = await redis.lrange(this.REDIS_TIMELINE_KEY, 0, limit - 1);
      return rawRecords.map(rec => JSON.parse(rec));
    } catch (err) {
      this.logger.error(`Failed to read historical timeline from Redis: ${err.message}`);
      return [];
    }
  }

  /**
   * Direct fetch REST integration with Google Gemini Pro API.
   */
  private async callGeminiAPI(apiKey: string, context: any): Promise<AIAnalysisReport> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
    
    const prompt = `You are a senior site reliability engineer (SRE) and AI observability assistant for a BullMQ + Redis background job monorepo.
Analyze the following active system state:
${JSON.stringify(context, null, 2)}

Provide a concise, operational diagnostic report in JSON format. Do NOT write long conversational paragraphs.
Your response MUST be a single, valid JSON object matching the following TypeScript interface strictly:
interface AIAnalysisReport {
  timestamp: number; // set to current timestamp
  rootCause: string; // e.g. "SendGrid rate limits (429) stalling active email queue workers."
  severity: "CRITICAL" | "WARNING" | "HEALTHY";
  likelyImpact: string; // e.g. "Active jobs stalled. Email signups and verification messages backing up."
  recommendedFix: string; // copyable code block or specific concrete CLI steps
  scalingRecommendation: string; // concise scaling fix, e.g. HPA values or BullMQ concurrency factors
}

Keep explanations extremely strict, operational, and short. Examples:
- "Retry loop detected on email queue"
- "Stripe webhook worker latency spikes 430%"
- "Dead-letter queue growing abnormally fast"

Ensure the JSON returned is well-formatted and does not contain markdown codeblocks like \`\`\`json.`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    if (!res.ok) {
      throw new Error(`Google API responded with status ${res.status}`);
    }

    const payload: any = await res.json();
    const rawText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean markdown wraps if the model returned them
    const jsonString = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(jsonString) as AIAnalysisReport;
  }

  /**
   * Highly detailed dynamic mocked analysis engine that reflects active errors in the system.
   */
  private compileMockAnalysis(context: any): AIAnalysisReport {
    const { simulators, dlqCount, queues } = context;

    // Default healthy operational blueprint
    let report: AIAnalysisReport = {
      timestamp: Date.now(),
      rootCause: 'All systems operational.',
      severity: 'HEALTHY',
      likelyImpact: 'Queue workloads processing within expected SLA latency thresholds.',
      recommendedFix: '// All worker heartbeats active. No repairs required.',
      scalingRecommendation: 'Current replica sets and concurrency bounds are balanced.',
    };

    if (simulators.simulateSmtpFailure) {
      report = {
        timestamp: Date.now(),
        rootCause: 'SMTP SendGrid Rate Limit Exceeded (HTTP 429)',
        severity: 'CRITICAL',
        likelyImpact: 'Email queue stalled. Password resets and verification dispatches backed up.',
        recommendedFix: `// Add dynamic limiter configurations to email_queue worker
const emailWorker = new Worker('email_queue', async (job) => {
  await sendGridMail(job.data);
}, {
  concurrency: 1, // Constrain concurrency to prevent rate blocks
  limiter: {
    max: 10,
    duration: 1000 // Limit to max 10 emails/sec
  }
});`,
        scalingRecommendation: 'Constrain active worker replicas. Do not auto-scale threads under SendGrid throttle.',
      };
    } else if (simulators.simulateWebhookOutage) {
      report = {
        timestamp: Date.now(),
        rootCause: 'Stripe Webhook Delivery Outage (HTTP 503 Gateway Timeout)',
        severity: 'CRITICAL',
        likelyImpact: 'Stripe payments and invoice hooks failing. Customer subscription upgrades delayed.',
        recommendedFix: `// Enforce a Circuit Breaker around the worker HTTP clients
import CircuitBreaker from 'opossum';

const options = {
  timeout: 3000, // Trigger fallback if Stripe exceeds 3s
  errorThresholdPercentage: 50,
  resetTimeout: 30000 // Keep circuit open for 30s
};

const stripeBreaker = new CircuitBreaker(stripeCall, options);
stripeBreaker.fallback(() => {
  throw new Error('CircuitOpen: deferring webhook attempt to backoff pool');
});`,
        scalingRecommendation: 'Integrate BullMQ exponential backoffs and increase active retry thresholds to 5 attempts.',
      };
    } else if (simulators.simulateInvalidPayload) {
      report = {
        timestamp: Date.now(),
        rootCause: 'Zod Payload Validation Mismatch (Missing required parameter)',
        severity: 'WARNING',
        likelyImpact: 'Consecutive job execution failures. Bad image metadata is entering worker memory.',
        recommendedFix: `// Validate payload schemas BEFORE enqueuing to protect Redis ticks
import { z } from 'zod';

const ImageSchema = z.object({
  imageUrl: z.string().url(),
  userId: z.string()
});

async function safeEnqueue(data: unknown) {
  const result = ImageSchema.safeParse(data);
  if (!result.success) {
    throw new Error('Invalid payload parameters: ' + result.error.message);
  }
  return myQueue.add('process_image', result.data);
}`,
        scalingRecommendation: 'Add an API Gateway pre-enqueue validator layer to intercept unverified inputs.',
      };
    } else if (simulators.simulateWorkerSlowdown) {
      report = {
        timestamp: Date.now(),
        rootCause: 'Worker Thread Latency Bloat (>8000ms delay block)',
        severity: 'WARNING',
        likelyImpact: 'Average processing latency spikes to 8.4 seconds. Job queue congestion backing up.',
        recommendedFix: `// recommended worker scale adjustment
// Increase BullMQ worker concurrency parameters
const worker = new Worker('image_processing_queue', handler, {
  concurrency: 8 // Increase from 2 to 8 threads
});`,
        scalingRecommendation: 'Scale active worker node replicas using Horizontal Pod Autoscaler (HPA) targeting 75% CPU load.',
      };
    } else if (dlqCount > 0) {
      report = {
        timestamp: Date.now(),
        rootCause: 'Dead-letter Queue Growth unusual activity',
        severity: 'WARNING',
        likelyImpact: `There are ${dlqCount} failed jobs stuck in dead-letter pools. Critical transactions are lost.`,
        recommendedFix: 'Audit stack traces inside Dead-Letter table, fix payload constraints, and click Replay Job to resubmit.',
        scalingRecommendation: 'Implement automated DLQ alerting integrations using Sentry/Slack webhooks.',
      };
    }

    return report;
  }

  /**
   * Pushes a critical snapshot to the Redis list chronology.
   */
  private async saveSnapshotToRedis(report: AIAnalysisReport): Promise<void> {
    try {
      const redis = this.queuesService.getRedisConnection();
      if (!redis) return;

      // Check the latest record in Redis to prevent logging duplicate identical incidents consecutively
      const latestRaw = await redis.lindex(this.REDIS_TIMELINE_KEY, 0);
      if (latestRaw) {
        const latest = JSON.parse(latestRaw) as AIAnalysisReport;
        if (latest.rootCause === report.rootCause && (Date.now() - latest.timestamp < 30000)) {
          // Skip if it's the exact same incident and logged less than 30s ago
          return;
        }
      }

      await redis.lpush(this.REDIS_TIMELINE_KEY, JSON.stringify(report));
      await redis.ltrim(this.REDIS_TIMELINE_KEY, 0, 49); // Keep last 50 snapshots in memory
      this.logger.log(`Persisted AI anomaly snapshot in Redis timeline: "${report.rootCause}"`);
    } catch (err) {
      this.logger.warn(`Failed to persist snapshot in Redis list: ${err.message}`);
    }
  }
}
