import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { 
  User, Incident, TelemetryEvent, LogEntry, AlertRule, AlertNotification, 
  InvestigationReport, DeadLetterJob, IncidentComment, NotificationSetting, 
  EscalationRule, DeploymentEvent, Notification, KnowledgeEntry, Runbook,
  Service, Environment, DependencyGraph, ReliabilityScore, Prediction, GlobalHealth,
  WorkerHealth, QueueName
} from '@queuewatch/shared';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  private redis: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
    const port = this.configService.get<number>('REDIS_PORT') || 6379;

    this.redis = new Redis({
      host,
      port,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.redis.on('connect', () => {
      this.logger.log('Successfully connected persistent DB client to Redis.');
      this.seedInitialData();
    });
  }

  onModuleDestroy() {
    if (this.redis) {
      this.redis.disconnect();
    }
  }

  getRedis(): Redis {
    return this.redis;
  }

  private async seedInitialData() {
    // Seed default admin user and demo API key
    const demoUserExists = await this.redis.exists('queuewatch:users:admin');
    if (!demoUserExists) {
      await this.redis.set('queuewatch:users:admin', JSON.stringify({
        id: 'u_admin',
        username: 'admin',
        passwordHash: '$2b$10$v7g8w.a7s8d9f0g1h2j3k4l5m6n7o8p9q0r1s2t3u4v5w6x7y8z9a', // dummy
        role: 'ADMIN',
      }));
    }

    const demoKeyExists = await this.redis.exists('queuewatch:api_keys:qw_demo_api_key_v2');
    if (!demoKeyExists) {
      await this.redis.set('queuewatch:api_keys:qw_demo_api_key_v2', 'admin');
    }

    // Seed default alert rules if empty
    const rulesCount = await this.redis.hlen('queuewatch:alert_rules');
    if (rulesCount === 0) {
      const defaultRules = [
        {
          id: 'rule_failures',
          name: 'Critical Queue Failure Rate Trigger',
          queueName: 'email_notifications',
          metric: 'failureRate',
          operator: '>',
          threshold: 15,
          durationSeconds: 60,
          severity: 'critical',
          enabled: true,
        },
        {
          id: 'rule_backlog',
          name: 'Queue Backlog Accumulation Warning',
          queueName: 'webhook_delivery',
          metric: 'backlog',
          operator: '>',
          threshold: 25,
          durationSeconds: 30,
          severity: 'high',
          enabled: true,
        }
      ];

      for (const rule of defaultRules) {
        await this.redis.hset('queuewatch:alert_rules', rule.id, JSON.stringify(rule));
      }
    }

    // Seed default escalation rules
    const escRulesCount = await this.redis.hlen('queuewatch:escalation_rules');
    if (escRulesCount === 0) {
      const defaultEscRules = [
        {
          id: 'esc_rule_critical',
          name: 'Critical Incident SLA Escalation',
          queueName: 'all',
          severity: 'critical',
          condition: 'Unacknowledged > 10 min',
          delayMinutes: 10,
          channels: ['email', 'slack_webhook', 'dashboard'],
          enabled: true,
        },
        {
          id: 'esc_rule_webhook',
          name: 'Webhook Queue Failure Escalation',
          queueName: 'webhook_delivery',
          severity: 'high',
          condition: 'Immediate Escalation',
          delayMinutes: 0,
          channels: ['email', 'slack_webhook'],
          enabled: true,
        }
      ];

      for (const rule of defaultEscRules) {
        await this.redis.hset('queuewatch:escalation_rules', rule.id, JSON.stringify(rule));
      }
    }

    // Seed default knowledge base entries
    const knowCount = await this.redis.hlen('queuewatch:knowledge_base');
    if (knowCount === 0) {
      const defaultKnowledge = [
        {
          id: 'know_smtp_ratelimit',
          title: 'Outbound SMTP Rate Limiting',
          incidentId: 'inc_smtp_legacy',
          pattern: 'SMTP 429 Rate Limit Exceeded',
          rootCause: 'Third party email provider (SendGrid/Mailgun) returned rate limit errors.',
          resolution: 'Configure concurrency limiting on the email_notifications queue worker and adjust exponential retry backoff parameters.',
          preventionRecommendation: 'Apply rate limits globally across email tasks.',
          createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
        },
        {
          id: 'know_worker_leak',
          title: 'Worker Process Memory Leak',
          incidentId: 'inc_leak_legacy',
          pattern: 'Heap Out Of Memory Delays',
          rootCause: 'Image resizing library holding canvas references in closure leaks memory.',
          resolution: 'Nullify canvas instances explicitly in completion handlers or upgrade node-sharp package.',
          preventionRecommendation: 'Monitor worker memory metrics closely and apply heap limit restarts.',
          createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
        }
      ];

      for (const entry of defaultKnowledge) {
        await this.redis.hset('queuewatch:knowledge_base', entry.id, JSON.stringify(entry));
      }
    }

    // Seed default runbooks
    const runbooksCount = await this.redis.hlen('queuewatch:runbooks');
    if (runbooksCount === 0) {
      const defaultRunbooks = [
        {
          id: 'run_smtp_ratelimit',
          incidentType: 'SMTP Rate Limiting',
          title: 'SMTP Outbound Rate Limiting Runbook',
          steps: [
            'Verify SendGrid/Mailgun status page for external outages.',
            'Access simulation control panel and throttle queue traffic.',
            'Scale email_notifications worker concurrency settings to 1 or 2.',
            'Execute dead-letter replay jobs for pending emails.'
          ],
          linkedIncidentIds: [],
          createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
        },
        {
          id: 'run_dlq_growth',
          incidentType: 'Dead-Letter growth',
          title: 'Dead-Letter Queue Recovery Runbook',
          steps: [
            'Retrieve last 5 failed jobs from dead-letter queue metrics.',
            'Inspect payload properties to see if validation errors exist.',
            'If payloads are correct, replay dead-letter jobs.',
            'If code error exists, roll back recent deployment version.'
          ],
          linkedIncidentIds: [],
          createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
        }
      ];

      for (const rb of defaultRunbooks) {
        await this.redis.hset('queuewatch:runbooks', rb.id, JSON.stringify(rb));
      }
    }

    // Seed default environments
    const envsCount = await this.redis.hlen('queuewatch:environments');
    if (envsCount === 0) {
      const defaultEnvs = [
        { id: 'env_prod', name: 'production', type: 'production' },
        { id: 'env_staging', name: 'staging', type: 'staging' },
        { id: 'env_dev', name: 'development', type: 'development' },
      ];
      for (const env of defaultEnvs) {
        await this.redis.hset('queuewatch:environments', env.name, JSON.stringify(env));
      }
    }

    // Seed default services
    const servicesCount = await this.redis.hlen('queuewatch:services');
    if (servicesCount === 0) {
      const defaultServices = [
        {
          id: 'svc_order',
          name: 'Order Service',
          description: 'Ingests inbound purchases and processes checkout actions.',
          environment: 'production',
          owner: 'order-team',
          status: 'healthy',
          createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
          queues: [],
          workers: [],
          deployments: [],
          incidents: [],
        },
        {
          id: 'svc_payment',
          name: 'Payment Service',
          description: 'Communicates with Stripe and processes invoices.',
          environment: 'production',
          owner: 'finance-team',
          status: 'degraded',
          createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
          queues: ['webhook_delivery'],
          workers: ['webhook_delivery'],
          deployments: [],
          incidents: [],
        },
        {
          id: 'svc_notification',
          name: 'Notification Service',
          description: 'Dispatches newsletters and verification codes.',
          environment: 'production',
          owner: 'marketing-team',
          status: 'healthy',
          createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
          queues: ['email_notifications'],
          workers: ['email_notifications'],
          deployments: [],
          incidents: [],
        },
        {
          id: 'svc_media',
          name: 'Media Service',
          description: 'Resizes profiles and compresses user uploads.',
          environment: 'production',
          owner: 'media-team',
          status: 'healthy',
          createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
          queues: ['image_processing'],
          workers: ['image_processing'],
          deployments: [],
          incidents: [],
        },
        {
          id: 'svc_ai',
          name: 'AI Worker Service',
          description: 'Generates feedback loops via Ollama wrappers.',
          environment: 'production',
          owner: 'ai-team',
          status: 'healthy',
          createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
          queues: ['ai_tasks'],
          workers: ['ai_tasks'],
          deployments: [],
          incidents: [],
        }
      ];
      for (const svc of defaultServices) {
        await this.redis.hset('queuewatch:services', svc.id, JSON.stringify(svc));
      }
    }

    // Seed default dependency graph
    const depExists = await this.redis.exists('queuewatch:dependency_graph');
    if (!depExists) {
      const defaultGraph = {
        nodes: [
          { id: 'svc_order', label: 'Order Service', type: 'service' },
          { id: 'svc_payment', label: 'Payment Service', type: 'service' },
          { id: 'svc_notification', label: 'Notification Service', type: 'service' },
          { id: 'svc_media', label: 'Media Service', type: 'service' },
          { id: 'svc_ai', label: 'AI Worker Service', type: 'service' },
          { id: 'email_notifications', label: 'email_notifications', type: 'queue' },
          { id: 'webhook_delivery', label: 'webhook_delivery', type: 'queue' },
          { id: 'image_processing', label: 'image_processing', type: 'queue' },
          { id: 'ai_tasks', label: 'ai_tasks', type: 'queue' }
        ],
        edges: [
          { from: 'svc_order', to: 'webhook_delivery' },
          { from: 'webhook_delivery', to: 'svc_payment' },
          { from: 'svc_payment', to: 'email_notifications' },
          { from: 'email_notifications', to: 'svc_notification' },
          { from: 'svc_order', to: 'image_processing' },
          { from: 'image_processing', to: 'svc_media' },
          { from: 'svc_notification', to: 'ai_tasks' },
          { from: 'ai_tasks', to: 'svc_ai' }
        ],
        serviceImpacts: {
          svc_order: ['svc_payment', 'svc_notification', 'svc_media'],
          svc_payment: ['svc_notification'],
          svc_notification: ['svc_ai']
        }
      };
      await this.redis.set('queuewatch:dependency_graph', JSON.stringify(defaultGraph));
    }

    // Seed default predictions
    const predictionsCount = await this.redis.hlen('queuewatch:predictions');
    if (predictionsCount === 0) {
      const defaultPredictions = [
        {
          id: 'pred_1',
          title: 'Backlog Saturation Risk',
          riskScore: 78,
          confidenceScore: 85,
          estimatedImpact: 'Webhook Delivery Queue delayed by > 15 minutes, slowing checkout callback processing.',
          recommendedActions: [
            'Scale worker concurrency replicas to 4 channels',
            'Throttle simulation background rates',
            'Investigate Stripe callback API latencies'
          ],
          reason: 'Webhook queue backlog processing speed has dropped below job creation speed for the last 5 minutes.',
          targetQueue: 'webhook_delivery',
          targetService: 'Payment Service',
          timestamp: Date.now(),
        },
        {
          id: 'pred_2',
          title: 'SMTP Rate Limit Cascade',
          riskScore: 45,
          confidenceScore: 72,
          estimatedImpact: 'Email alerts will experience delays up to 10 minutes.',
          recommendedActions: [
            'Reduce retries threshold factor',
            'Pause non-critical transaction alerts'
          ],
          reason: 'SendGrid error rate has spiked to 5% in the last 10 minutes.',
          targetQueue: 'email_notifications',
          targetService: 'Notification Service',
          timestamp: Date.now(),
        }
      ];
      for (const pred of defaultPredictions) {
        await this.redis.hset('queuewatch:predictions', pred.id, JSON.stringify(pred));
      }
    }
  }

  // --- Users API ---
  async getUser(username: string): Promise<any | null> {
    const raw = await this.redis.get(`queuewatch:users:${username}`);
    return raw ? JSON.parse(raw) : null;
  }

  async saveUser(user: any) {
    await this.redis.set(`queuewatch:users:${user.username}`, JSON.stringify(user));
  }

  // --- API Keys (SDK Auth) ---
  async validateApiKey(key: string): Promise<string | null> {
    return this.redis.get(`queuewatch:api_keys:${key}`);
  }

  async saveApiKey(key: string, username: string) {
    await this.redis.set(`queuewatch:api_keys:${key}`, username);
  }

  // --- Incidents Storage ---
  async getIncidents(): Promise<Incident[]> {
    const rawList = await this.redis.hvals('queuewatch:incidents');
    return rawList.map(item => JSON.parse(item));
  }

  async getIncident(id: string): Promise<Incident | null> {
    const raw = await this.redis.hget('queuewatch:incidents', id);
    return raw ? JSON.parse(raw) : null;
  }

  async saveIncident(incident: Incident) {
    await this.redis.hset('queuewatch:incidents', incident.id, JSON.stringify(incident));
  }

  // --- Telemetry Storage ---
  async saveTelemetry(event: TelemetryEvent) {
    await this.redis.lpush('queuewatch:telemetry', JSON.stringify(event));
    await this.redis.ltrim('queuewatch:telemetry', 0, 999); // Keep last 1000 events
  }

  async getTelemetry(limit = 100): Promise<TelemetryEvent[]> {
    const list = await this.redis.lrange('queuewatch:telemetry', 0, limit - 1);
    return list.map(item => JSON.parse(item));
  }

  async getTelemetryByQueue(queueName: string, limit = 50): Promise<TelemetryEvent[]> {
    const all = await this.getTelemetry(200);
    return all.filter(item => item.queueName === queueName).slice(0, limit);
  }

  async getWorkers(): Promise<WorkerHealth[]> {
    const rawList = await this.redis.hvals('queuewatch:workers');
    if (rawList.length > 0) {
      return rawList.map(item => JSON.parse(item));
    }
    const queueNames: QueueName[] = ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'];
    return queueNames.map(name => ({
      workerId: `worker_${name}_1`,
      queueName: name,
      status: 'healthy',
      concurrency: name === 'email_notifications' ? 2 : 5,
      cpuUsage: 12,
      memoryUsage: 25,
      lastActive: Date.now()
    }));
  }

  // --- Logs Storage ---
  async saveLog(entry: LogEntry) {
    await this.redis.lpush('queuewatch:logs', JSON.stringify(entry));
    await this.redis.ltrim('queuewatch:logs', 0, 1999); // Keep last 2000 log lines
  }

  async getLogs(queueName?: string, limit = 100): Promise<LogEntry[]> {
    const list = await this.redis.lrange('queuewatch:logs', 0, -1);
    const parsed = list.map(item => JSON.parse(item) as LogEntry);
    if (queueName) {
      return parsed.filter(item => item.queueName === queueName).slice(0, limit);
    }
    return parsed.slice(0, limit);
  }

  // --- Investigations Storage ---
  async getInvestigation(incidentId: string): Promise<InvestigationReport | null> {
    const raw = await this.redis.get(`queuewatch:investigations:${incidentId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async saveInvestigation(report: InvestigationReport) {
    await this.redis.set(`queuewatch:investigations:${report.incidentId}`, JSON.stringify(report));
  }

  // --- Alert Rules Storage ---
  async getAlertRules(): Promise<AlertRule[]> {
    const rawList = await this.redis.hvals('queuewatch:alert_rules');
    return rawList.map(item => JSON.parse(item));
  }

  async getAlertRule(id: string): Promise<AlertRule | null> {
    const raw = await this.redis.hget('queuewatch:alert_rules', id);
    return raw ? JSON.parse(raw) : null;
  }

  async saveAlertRule(rule: AlertRule) {
    await this.redis.hset('queuewatch:alert_rules', rule.id, JSON.stringify(rule));
  }

  async deleteAlertRule(id: string) {
    await this.redis.hdel('queuewatch:alert_rules', id);
  }

  // --- Alert Notifications ---
  async getAlertNotifications(limit = 50): Promise<AlertNotification[]> {
    const list = await this.redis.lrange('queuewatch:alert_notifications', 0, limit - 1);
    return list.map(item => JSON.parse(item));
  }

  async saveAlertNotification(notif: AlertNotification) {
    await this.redis.lpush('queuewatch:alert_notifications', JSON.stringify(notif));
    await this.redis.ltrim('queuewatch:alert_notifications', 0, 99); // Keep last 100 notifications
  }

  // --- Dead Letter Jobs ---
  async getDeadLetterJobs(): Promise<DeadLetterJob[]> {
    const rawList = await this.redis.hvals('queuewatch:dead_letter_jobs');
    return rawList.map(item => JSON.parse(item));
  }

  async getDeadLetterJob(id: string): Promise<DeadLetterJob | null> {
    const raw = await this.redis.hget('queuewatch:dead_letter_jobs', id);
    return raw ? JSON.parse(raw) : null;
  }

  async saveDeadLetterJob(job: DeadLetterJob) {
    await this.redis.hset('queuewatch:dead_letter_jobs', job.id, JSON.stringify(job));
  }

  async deleteDeadLetterJob(id: string) {
    await this.redis.hdel('queuewatch:dead_letter_jobs', id);
  }

  // --- Comments ---
  async getComments(incidentId: string): Promise<IncidentComment[]> {
    const rawList = await this.redis.hvals(`queuewatch:comments:${incidentId}`);
    return rawList.map(item => JSON.parse(item)).sort((a, b) => a.createdAt - b.createdAt);
  }

  async saveComment(comment: IncidentComment) {
    await this.redis.hset(`queuewatch:comments:${comment.incidentId}`, comment.id, JSON.stringify(comment));
  }

  async deleteComment(incidentId: string, commentId: string) {
    await this.redis.hdel(`queuewatch:comments:${incidentId}`, commentId);
  }

  // --- Notification Settings ---
  async getNotificationSettings(userId: string): Promise<NotificationSetting> {
    const raw = await this.redis.get(`queuewatch:notification_settings:${userId}`);
    if (raw) return JSON.parse(raw);
    // Return default settings
    return {
      emailEnabled: true,
      dashboardEnabled: true,
      webhookEnabled: false,
      severities: ['low', 'medium', 'high', 'critical'],
      queues: ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'],
    };
  }

  async saveNotificationSettings(userId: string, settings: NotificationSetting) {
    await this.redis.set(`queuewatch:notification_settings:${userId}`, JSON.stringify(settings));
  }

  // --- Escalation Rules ---
  async getEscalationRules(): Promise<EscalationRule[]> {
    const rawList = await this.redis.hvals('queuewatch:escalation_rules');
    return rawList.map(item => JSON.parse(item));
  }

  async getEscalationRule(id: string): Promise<EscalationRule | null> {
    const raw = await this.redis.hget('queuewatch:escalation_rules', id);
    return raw ? JSON.parse(raw) : null;
  }

  async saveEscalationRule(rule: EscalationRule) {
    await this.redis.hset('queuewatch:escalation_rules', rule.id, JSON.stringify(rule));
  }

  async deleteEscalationRule(id: string) {
    await this.redis.hdel('queuewatch:escalation_rules', id);
  }

  // --- Deployment Events ---
  async getDeploymentEvents(): Promise<DeploymentEvent[]> {
    const list = await this.redis.lrange('queuewatch:deployments', 0, -1);
    return list.map(item => JSON.parse(item));
  }

  async saveDeploymentEvent(event: DeploymentEvent) {
    await this.redis.lpush('queuewatch:deployments', JSON.stringify(event));
    await this.redis.ltrim('queuewatch:deployments', 0, 99); // Keep last 100 deployments
  }

  // --- V3 Notifications ---
  async getNotifications(limit = 100): Promise<Notification[]> {
    const list = await this.redis.lrange('queuewatch:notifications', 0, limit - 1);
    return list.map(item => JSON.parse(item));
  }

  async saveNotification(notif: Notification) {
    await this.redis.lpush('queuewatch:notifications', JSON.stringify(notif));
    await this.redis.ltrim('queuewatch:notifications', 0, 499); // Keep last 500 notifications
  }

  // --- V4 Knowledge Base ---
  async getKnowledgeEntries(): Promise<KnowledgeEntry[]> {
    const rawList = await this.redis.hvals('queuewatch:knowledge_base');
    return rawList.map(item => JSON.parse(item)).sort((a, b) => b.createdAt - a.createdAt);
  }

  async saveKnowledgeEntry(entry: KnowledgeEntry) {
    await this.redis.hset('queuewatch:knowledge_base', entry.id, JSON.stringify(entry));
  }

  // --- V4 Runbooks ---
  async getRunbooks(): Promise<Runbook[]> {
    const rawList = await this.redis.hvals('queuewatch:runbooks');
    return rawList.map(item => JSON.parse(item)).sort((a, b) => b.createdAt - a.createdAt);
  }

  async getRunbook(id: string): Promise<Runbook | null> {
    const raw = await this.redis.hget('queuewatch:runbooks', id);
    return raw ? JSON.parse(raw) : null;
  }

  async saveRunbook(runbook: Runbook) {
    await this.redis.hset('queuewatch:runbooks', runbook.id, JSON.stringify(runbook));
  }

  // --- V5 Service Registry ---
  async getServices(): Promise<Service[]> {
    const rawList = await this.redis.hvals('queuewatch:services');
    return rawList.map(item => JSON.parse(item));
  }

  async getService(id: string): Promise<Service | null> {
    const raw = await this.redis.hget('queuewatch:services', id);
    return raw ? JSON.parse(raw) : null;
  }

  async saveService(service: Service) {
    await this.redis.hset('queuewatch:services', service.id, JSON.stringify(service));
  }

  async deleteService(id: string) {
    await this.redis.hdel('queuewatch:services', id);
  }

  async getEnvironments(): Promise<Environment[]> {
    const rawList = await this.redis.hvals('queuewatch:environments');
    return rawList.map(item => JSON.parse(item));
  }

  async saveEnvironment(env: Environment) {
    await this.redis.hset('queuewatch:environments', env.name, JSON.stringify(env));
  }

  // --- V5 Dependency Graph ---
  async getDependencyGraph(): Promise<DependencyGraph> {
    const raw = await this.redis.get('queuewatch:dependency_graph');
    if (raw) return JSON.parse(raw);
    return { nodes: [], edges: [], serviceImpacts: {} };
  }

  async saveDependencyGraph(graph: DependencyGraph) {
    await this.redis.set('queuewatch:dependency_graph', JSON.stringify(graph));
  }

  // --- V5 Reliability Scores ---
  async getReliabilityScores(): Promise<ReliabilityScore[]> {
    const rawList = await this.redis.hvals('queuewatch:reliability_scores');
    return rawList.map(item => JSON.parse(item));
  }

  async saveReliabilityScore(score: ReliabilityScore) {
    await this.redis.hset('queuewatch:reliability_scores', `${score.targetType}:${score.targetId}`, JSON.stringify(score));
    await this.redis.lpush(`queuewatch:reliability_history:${score.targetId}`, JSON.stringify(score));
    await this.redis.ltrim(`queuewatch:reliability_history:${score.targetId}`, 0, 99);
  }

  async getReliabilityHistory(targetId: string): Promise<ReliabilityScore[]> {
    const list = await this.redis.lrange(`queuewatch:reliability_history:${targetId}`, 0, -1);
    return list.map(item => JSON.parse(item));
  }

  // --- V5 Predictions ---
  async getPredictions(): Promise<Prediction[]> {
    const rawList = await this.redis.hvals('queuewatch:predictions');
    return rawList.map(item => JSON.parse(item)).sort((a, b) => b.timestamp - a.timestamp);
  }

  async getPrediction(id: string): Promise<Prediction | null> {
    const raw = await this.redis.hget('queuewatch:predictions', id);
    return raw ? JSON.parse(raw) : null;
  }

  async savePrediction(pred: Prediction) {
    await this.redis.hset('queuewatch:predictions', pred.id, JSON.stringify(pred));
  }
}
