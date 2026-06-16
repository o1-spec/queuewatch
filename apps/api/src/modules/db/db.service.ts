import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { 
  User, Incident, TelemetryEvent, LogEntry, AlertRule, AlertNotification, 
  InvestigationReport, DeadLetterJob, IncidentComment, NotificationSetting, 
  EscalationRule, DeploymentEvent, Notification, KnowledgeEntry, Runbook,
  Service, Environment, DependencyGraph, ReliabilityScore, Prediction, GlobalHealth,
  WorkerHealth, QueueName, Project, RetentionPolicy
} from '@queuewatch/shared';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DbService.name);
  private redis: Redis;

  // Lazily injected to break circular dependency with RetentionModule
  private retentionService: import('../retention/retention.service').RetentionService | null = null;

  setRetentionService(svc: import('../retention/retention.service').RetentionService) {
    this.retentionService = svc;
  }

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        retryStrategy: (times) => Math.min(times * 100, 3000),
      });
    } else {
      const host = this.configService.get<string>('REDIS_HOST') || 'localhost';
      const port = this.configService.get<number>('REDIS_PORT') || 6379;

      this.redis = new Redis({
        host,
        port,
        retryStrategy: (times) => Math.min(times * 100, 3000),
      });
    }

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

  private getScopedKey(projectId: string | undefined, baseKey: string): string {
    const pid = projectId || 'proj_demo';
    return `queuewatch:project:${pid}:${baseKey}`;
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

    const enableSimulator = this.configService.get<string>('ENABLE_SIMULATOR') === 'true';
    if (!enableSimulator) {
      this.logger.log('Seed generator: Skipping demo project data seed (ENABLE_SIMULATOR is not true).');
      return;
    }

    // Seed default project proj_demo
    const demoProjExists = await this.redis.exists('queuewatch:project_metadata:proj_demo');
    if (!demoProjExists) {
      const demoProject: Project = {
        id: 'proj_demo',
        name: 'Demo Project',
        apiKey: 'qw_demo_api_key_v2',
        createdAt: Date.now(),
      };
      await this.redis.set('queuewatch:project_metadata:proj_demo', JSON.stringify(demoProject));
      await this.redis.sadd('queuewatch:user_projects:demo_user_sre_910', 'proj_demo');
      await this.redis.sadd('queuewatch:user_projects:u_admin', 'proj_demo');
    }

    // Seed default API key mapping for qw_demo_api_key_v2
    const demoKeyExists = await this.redis.exists('queuewatch:api_keys:qw_demo_api_key_v2');
    if (!demoKeyExists) {
      await this.redis.set(
        'queuewatch:api_keys:qw_demo_api_key_v2',
        JSON.stringify({ projectId: 'proj_demo', userId: 'demo_user_sre_910' })
      );
    }

    const demoProjKey = 'proj_demo';

    // Seed default alert rules if empty
    const alertRulesKey = this.getScopedKey(demoProjKey, 'alert_rules');
    const rulesCount = await this.redis.hlen(alertRulesKey);
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
        await this.redis.hset(alertRulesKey, rule.id, JSON.stringify(rule));
      }
    }

    // Seed default escalation rules
    const escRulesKey = this.getScopedKey(demoProjKey, 'escalation_rules');
    const escRulesCount = await this.redis.hlen(escRulesKey);
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
        await this.redis.hset(escRulesKey, rule.id, JSON.stringify(rule));
      }
    }

    // Seed default knowledge base entries
    const kbKey = this.getScopedKey(demoProjKey, 'knowledge_base');
    const knowCount = await this.redis.hlen(kbKey);
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
        await this.redis.hset(kbKey, entry.id, JSON.stringify(entry));
      }
    }

    // Seed default runbooks
    const rbKey = this.getScopedKey(demoProjKey, 'runbooks');
    const runbooksCount = await this.redis.hlen(rbKey);
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
        await this.redis.hset(rbKey, rb.id, JSON.stringify(rb));
      }
    }

    // Seed default environments
    const envsKey = this.getScopedKey(demoProjKey, 'environments');
    const envsCount = await this.redis.hlen(envsKey);
    if (envsCount === 0) {
      const defaultEnvs = [
        { id: 'env_prod', name: 'production', type: 'production' },
        { id: 'env_staging', name: 'staging', type: 'staging' },
        { id: 'env_dev', name: 'development', type: 'development' },
      ];
      for (const env of defaultEnvs) {
        await this.redis.hset(envsKey, env.name, JSON.stringify(env));
      }
    }

    // Seed default services
    const servicesKey = this.getScopedKey(demoProjKey, 'services');
    const servicesCount = await this.redis.hlen(servicesKey);
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
        await this.redis.hset(servicesKey, svc.id, JSON.stringify(svc));
      }
    }

    // Seed default dependency graph
    const dgKey = this.getScopedKey(demoProjKey, 'dependency_graph');
    const depExists = await this.redis.exists(dgKey);
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
      await this.redis.set(dgKey, JSON.stringify(defaultGraph));
    }

    // Seed default predictions
    const predictionsKey = this.getScopedKey(demoProjKey, 'predictions');
    const predictionsCount = await this.redis.hlen(predictionsKey);
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
        await this.redis.hset(predictionsKey, pred.id, JSON.stringify(pred));
      }
    }
  }

  // --- Users API ---
  async getUser(username: string): Promise<any | null> {
    const raw = await this.redis.get(`queuewatch:users:${username.toLowerCase()}`);
    return raw ? JSON.parse(raw) : null;
  }

  async saveUser(user: any) {
    const key = (user.email || user.username || '').toLowerCase();
    await this.redis.set(`queuewatch:users:${key}`, JSON.stringify(user));
  }

  // --- API Keys (SDK Auth) ---
  async validateApiKey(key: string): Promise<string | null> {
    const mapping = await this.resolveApiKey(key);
    return mapping ? mapping.userId : null;
  }

  async saveApiKey(key: string, username: string) {
    await this.redis.set(`queuewatch:api_keys:${key}`, JSON.stringify({ projectId: 'proj_demo', userId: username }));
  }

  // --- Projects Storage ---
  async getProjects(userId: string): Promise<Project[]> {
    const projectIds = await this.redis.smembers(`queuewatch:user_projects:${userId}`);
    if (!projectIds || projectIds.length === 0) return [];
    const projects: Project[] = [];
    for (const pid of projectIds) {
      const p = await this.getProject(pid);
      if (p) projects.push(p);
    }
    return projects;
  }

  async getAllProjects(): Promise<Project[]> {
    const keys = await this.redis.keys('queuewatch:project_metadata:*');
    const projects: Project[] = [];
    for (const key of keys) {
      const raw = await this.redis.get(key);
      if (raw) {
        projects.push(JSON.parse(raw) as Project);
      }
    }
    return projects;
  }

  async getProject(projectId: string): Promise<Project | null> {
    const raw = await this.redis.get(`queuewatch:project_metadata:${projectId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async saveProject(project: Project, userId: string): Promise<void> {
    await this.redis.set(`queuewatch:project_metadata:${project.id}`, JSON.stringify(project));
    await this.redis.sadd(`queuewatch:user_projects:${userId}`, project.id);
  }

  async markProjectTelemetryReceived(projectId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (project && !project.hasReceivedTelemetry) {
      project.hasReceivedTelemetry = true;
      project.firstTelemetryAt = Date.now();
      await this.redis.set(`queuewatch:project_metadata:${projectId}`, JSON.stringify(project));
      this.logger.log(`Project ${projectId} telemetry state marked as active.`);
    }
  }

  async discoverService(
    projectId: string,
    serviceName?: string,
    queueName?: string,
    workerId?: string,
  ): Promise<void> {
    let resolvedService = serviceName;
    if (!resolvedService && queueName) {
      if (['payment_queue', 'email_queue', 'webhook_queue'].includes(queueName)) {
        resolvedService = 'payment-service';
      } else if (['email_notifications'].includes(queueName)) {
        resolvedService = 'email-service';
      } else {
        resolvedService = 'default-service';
      }
    }

    if (!resolvedService) return;

    const serviceId = `svc_${resolvedService.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
    let service = await this.getService(serviceId, projectId);
    let changed = false;

    if (!service) {
      service = {
        id: serviceId,
        name: resolvedService,
        description: `Automatically discovered service from SDK telemetry.`,
        environment: 'production',
        owner: 'sre-team',
        status: 'healthy',
        createdAt: Date.now(),
        queues: [],
        workers: [],
        deployments: [],
        incidents: [],
      };
      changed = true;
    }

    if (queueName && !service.queues.includes(queueName)) {
      service.queues.push(queueName);
      changed = true;
    }

    if (workerId && !service.workers.includes(workerId)) {
      service.workers.push(workerId);
      changed = true;
    }

    if (changed) {
      await this.saveService(service, projectId);

      if (queueName) {
        await this.registerProjectQueue(projectId, queueName);
      }

      const graph = await this.getDependencyGraph(projectId);
      let graphChanged = false;

      if (!graph.nodes.some(n => n.id === serviceId)) {
        graph.nodes.push({ id: serviceId, label: resolvedService, type: 'service' });
        graphChanged = true;
      }

      if (queueName && !graph.nodes.some(n => n.id === queueName)) {
        graph.nodes.push({ id: queueName, label: queueName, type: 'queue' });
        graphChanged = true;
      }

      if (queueName && !graph.edges.some(e => e.from === serviceId && e.to === queueName)) {
        graph.edges.push({ from: serviceId, to: queueName });
        graphChanged = true;
      }

      if (queueName) {
        if (!graph.serviceImpacts[serviceId]) {
          graph.serviceImpacts[serviceId] = [];
        }
        if (!graph.serviceImpacts[serviceId].includes(queueName)) {
          graph.serviceImpacts[serviceId].push(queueName);
          graphChanged = true;
        }
      }

      if (graphChanged) {
        await this.saveDependencyGraph(graph, projectId);
      }
    }
  }

  async registerProjectQueue(projectId: string, queueName: string): Promise<void> {
    await this.redis.sadd(`queuewatch:project:${projectId}:queues`, queueName);
  }

  async getProjectQueues(projectId: string): Promise<string[]> {
    if (projectId === 'proj_demo') {
      return ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'];
    }
    return this.redis.smembers(`queuewatch:project:${projectId}:queues`);
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (project) {
      await this.redis.del(`queuewatch:project_metadata:${projectId}`);
      await this.redis.srem(`queuewatch:user_projects:${userId}`, projectId);
      if (project.apiKey) {
        await this.redis.del(`queuewatch:api_keys:${project.apiKey}`);
      }
    }
  }

  async saveApiKeyMapping(apiKey: string, metadata: { projectId: string; userId: string }): Promise<void> {
    await this.redis.set(`queuewatch:api_keys:${apiKey}`, JSON.stringify(metadata));
  }

  async resolveApiKey(apiKey: string): Promise<{ projectId: string; userId: string } | null> {
    const raw = await this.redis.get(`queuewatch:api_keys:${apiKey}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return { projectId: 'proj_demo', userId: raw };
    }
  }

  // --- Incidents Storage ---
  async getIncidents(projectId?: string): Promise<Incident[]> {
    const rawList = await this.redis.hvals(this.getScopedKey(projectId, 'incidents'));
    return rawList.map(item => JSON.parse(item));
  }

  async getIncident(id: string, projectId?: string): Promise<Incident | null> {
    const raw = await this.redis.hget(this.getScopedKey(projectId, 'incidents'), id);
    return raw ? JSON.parse(raw) : null;
  }

  async saveIncident(incident: Incident, projectId?: string) {
    await this.redis.hset(this.getScopedKey(projectId, 'incidents'), incident.id, JSON.stringify(incident));
  }

  // --- Incident Timeline Storage ---
  async getIncidentTimeline(incidentId: string, projectId?: string): Promise<any[]> {
    const raw = await this.redis.get(this.getScopedKey(projectId, `incident:${incidentId}:timeline`));
    return raw ? JSON.parse(raw) : [];
  }

  async saveIncidentTimeline(incidentId: string, timeline: any[], projectId?: string) {
    await this.redis.set(this.getScopedKey(projectId, `incident:${incidentId}:timeline`), JSON.stringify(timeline));
  }

  async deleteIncidentTimeline(incidentId: string, projectId?: string) {
    await this.redis.del(this.getScopedKey(projectId, `incident:${incidentId}:timeline`));
  }

  // --- Telemetry Storage ---
  async saveTelemetry(event: TelemetryEvent, projectId?: string) {
    const key = this.getScopedKey(projectId, 'telemetry');
    await this.redis.lpush(key, JSON.stringify(event));
    await this.redis.ltrim(key, 0, 999); // keep last 1000 events
    if (this.retentionService) {
      const ttl = await this.retentionService.getTtlSeconds(projectId || 'proj_demo', 'telemetry');
      await this.redis.expire(key, ttl);
    }
  }

  async getTelemetry(limit = 100, projectId?: string): Promise<TelemetryEvent[]> {
    const list = await this.redis.lrange(this.getScopedKey(projectId, 'telemetry'), 0, limit - 1);
    return list.map(item => JSON.parse(item));
  }

  async getTelemetryByQueue(queueName: string, limit = 50, projectId?: string): Promise<TelemetryEvent[]> {
    const all = await this.getTelemetry(200, projectId);
    return all.filter(item => item.queueName === queueName).slice(0, limit);
  }

  async getWorkers(projectId?: string): Promise<WorkerHealth[]> {
    const rawList = await this.redis.hvals(this.getScopedKey(projectId, 'workers'));
    if (rawList.length > 0) {
      return rawList.map(item => JSON.parse(item));
    }
    if (projectId === 'proj_demo') {
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
    return [];
  }

  async saveWorker(worker: WorkerHealth, projectId?: string) {
    const key = this.getScopedKey(projectId, 'workers');
    await this.redis.hset(key, worker.workerId, JSON.stringify(worker));
    // Workers are ephemeral — expire the whole hash after 24h of no updates
    await this.redis.expire(key, 86_400);
  }

  // --- Logs Storage ---
  async saveLog(entry: LogEntry, projectId?: string) {
    const key = this.getScopedKey(projectId, 'logs');
    await this.redis.lpush(key, JSON.stringify(entry));
    await this.redis.ltrim(key, 0, 1999); // keep last 2000 log lines
    if (this.retentionService) {
      const ttl = await this.retentionService.getTtlSeconds(projectId || 'proj_demo', 'logs');
      await this.redis.expire(key, ttl);
    }
  }

  async getLogs(queueName?: string, limit = 100, projectId?: string): Promise<LogEntry[]> {
    const list = await this.redis.lrange(this.getScopedKey(projectId, 'logs'), 0, -1);
    const parsed = list.map(item => JSON.parse(item) as LogEntry);
    if (queueName) {
      return parsed.filter(item => item.queueName === queueName).slice(0, limit);
    }
    return parsed.slice(0, limit);
  }

  // --- Investigations Storage ---
  async getInvestigation(incidentId: string, projectId?: string): Promise<InvestigationReport | null> {
    const raw = await this.redis.get(this.getScopedKey(projectId, `investigations:${incidentId}`));
    return raw ? JSON.parse(raw) : null;
  }

  async saveInvestigation(report: InvestigationReport, projectId?: string) {
    await this.redis.set(this.getScopedKey(projectId, `investigations:${report.incidentId}`), JSON.stringify(report));
  }

  // --- Alert Rules Storage ---
  async getAlertRules(projectId?: string): Promise<AlertRule[]> {
    const rawList = await this.redis.hvals(this.getScopedKey(projectId, 'alert_rules'));
    return rawList.map(item => JSON.parse(item));
  }

  async getAlertRule(id: string, projectId?: string): Promise<AlertRule | null> {
    const raw = await this.redis.hget(this.getScopedKey(projectId, 'alert_rules'), id);
    return raw ? JSON.parse(raw) : null;
  }

  async saveAlertRule(rule: AlertRule, projectId?: string) {
    await this.redis.hset(this.getScopedKey(projectId, 'alert_rules'), rule.id, JSON.stringify(rule));
  }

  async deleteAlertRule(id: string, projectId?: string) {
    await this.redis.hdel(this.getScopedKey(projectId, 'alert_rules'), id);
  }

  // --- Alert Notifications ---
  async getAlertNotifications(limit = 50, projectId?: string): Promise<AlertNotification[]> {
    const list = await this.redis.lrange(this.getScopedKey(projectId, 'alert_notifications'), 0, limit - 1);
    return list.map(item => JSON.parse(item));
  }

  async saveAlertNotification(notif: AlertNotification, projectId?: string) {
    const key = this.getScopedKey(projectId, 'alert_notifications');
    await this.redis.lpush(key, JSON.stringify(notif));
    await this.redis.ltrim(key, 0, 99); // keep last 100 notifications
    if (this.retentionService) {
      const ttl = await this.retentionService.getTtlSeconds(projectId || 'proj_demo', 'notifications');
      await this.redis.expire(key, ttl);
    }
  }

  // --- Dead Letter Jobs ---
  async getDeadLetterJobs(projectId?: string): Promise<DeadLetterJob[]> {
    const rawList = await this.redis.hvals(this.getScopedKey(projectId, 'dead_letter_jobs'));
    return rawList.map(item => JSON.parse(item));
  }

  async getDeadLetterJob(id: string, projectId?: string): Promise<DeadLetterJob | null> {
    const raw = await this.redis.hget(this.getScopedKey(projectId, 'dead_letter_jobs'), id);
    return raw ? JSON.parse(raw) : null;
  }

  async saveDeadLetterJob(job: DeadLetterJob, projectId?: string) {
    await this.redis.hset(this.getScopedKey(projectId, 'dead_letter_jobs'), job.id, JSON.stringify(job));
  }

  async deleteDeadLetterJob(id: string, projectId?: string) {
    await this.redis.hdel(this.getScopedKey(projectId, 'dead_letter_jobs'), id);
  }

  // --- Comments ---
  async getComments(incidentId: string, projectId?: string): Promise<IncidentComment[]> {
    const rawList = await this.redis.hvals(this.getScopedKey(projectId, `comments:${incidentId}`));
    return rawList.map(item => JSON.parse(item)).sort((a, b) => a.createdAt - b.createdAt);
  }

  async saveComment(comment: IncidentComment, projectId?: string) {
    await this.redis.hset(this.getScopedKey(projectId, `comments:${comment.incidentId}`), comment.id, JSON.stringify(comment));
  }

  async deleteComment(incidentId: string, commentId: string, projectId?: string) {
    await this.redis.hdel(this.getScopedKey(projectId, `comments:${incidentId}`), commentId);
  }

  // --- Notification Settings ---
  async getNotificationSettings(userId: string): Promise<NotificationSetting> {
    const raw = await this.redis.get(`queuewatch:notification_settings:${userId}`);
    if (raw) return JSON.parse(raw);
    // Default settings: empty queues array means "all queues" (no filter)
    // emailEnabled defaults to false — set to true only when SMTP is configured
    return {
      emailEnabled: false,
      dashboardEnabled: true,
      webhookEnabled: false,
      severities: ['low', 'medium', 'high', 'critical'],
      queues: [], // empty = notify for all queues
    };
  }

  async saveNotificationSettings(userId: string, settings: NotificationSetting) {
    await this.redis.set(`queuewatch:notification_settings:${userId}`, JSON.stringify(settings));
  }

  // --- Escalation Rules ---
  async getEscalationRules(projectId?: string): Promise<EscalationRule[]> {
    const rawList = await this.redis.hvals(this.getScopedKey(projectId, 'escalation_rules'));
    return rawList.map(item => JSON.parse(item));
  }

  async getEscalationRule(id: string, projectId?: string): Promise<EscalationRule | null> {
    const raw = await this.redis.hget(this.getScopedKey(projectId, 'escalation_rules'), id);
    return raw ? JSON.parse(raw) : null;
  }

  async saveEscalationRule(rule: EscalationRule, projectId?: string) {
    await this.redis.hset(this.getScopedKey(projectId, 'escalation_rules'), rule.id, JSON.stringify(rule));
  }

  async deleteEscalationRule(id: string, projectId?: string) {
    await this.redis.hdel(this.getScopedKey(projectId, 'escalation_rules'), id);
  }

  // --- Deployment Events ---
  async getDeploymentEvents(projectId?: string): Promise<DeploymentEvent[]> {
    const list = await this.redis.lrange(this.getScopedKey(projectId, 'deployments'), 0, -1);
    return list.map(item => JSON.parse(item));
  }

  async saveDeploymentEvent(event: DeploymentEvent, projectId?: string) {
    const key = this.getScopedKey(projectId, 'deployments');
    await this.redis.lpush(key, JSON.stringify(event));
    await this.redis.ltrim(key, 0, 99); // Keep last 100 deployments
    if (this.retentionService) {
      const ttl = await this.retentionService.getTtlSeconds(projectId || 'proj_demo', 'deployments');
      await this.redis.expire(key, ttl);
    }
  }

  // --- V3 Notifications ---
  async getNotifications(limit = 100, projectId?: string): Promise<Notification[]> {
    const list = await this.redis.lrange(this.getScopedKey(projectId, 'notifications'), 0, limit - 1);
    return list.map(item => JSON.parse(item));
  }

  async saveNotification(notif: Notification, projectId?: string) {
    const key = this.getScopedKey(projectId, 'notifications');
    await this.redis.lpush(key, JSON.stringify(notif));
    await this.redis.ltrim(key, 0, 499); // keep last 500 notifications
    if (this.retentionService) {
      const ttl = await this.retentionService.getTtlSeconds(projectId || 'proj_demo', 'notifications');
      await this.redis.expire(key, ttl);
    }
  }

  // --- V4 Knowledge Base ---
  async getKnowledgeEntries(projectId?: string): Promise<KnowledgeEntry[]> {
    const rawList = await this.redis.hvals(this.getScopedKey(projectId, 'knowledge_base'));
    return rawList.map(item => JSON.parse(item)).sort((a, b) => b.createdAt - a.createdAt);
  }

  async saveKnowledgeEntry(entry: KnowledgeEntry, projectId?: string) {
    await this.redis.hset(this.getScopedKey(projectId, 'knowledge_base'), entry.id, JSON.stringify(entry));
  }

  // --- V4 Runbooks ---
  async getRunbooks(projectId?: string): Promise<Runbook[]> {
    const rawList = await this.redis.hvals(this.getScopedKey(projectId, 'runbooks'));
    return rawList.map(item => JSON.parse(item)).sort((a, b) => b.createdAt - a.createdAt);
  }

  async getRunbook(id: string, projectId?: string): Promise<Runbook | null> {
    const raw = await this.redis.hget(this.getScopedKey(projectId, 'runbooks'), id);
    return raw ? JSON.parse(raw) : null;
  }

  async saveRunbook(runbook: Runbook, projectId?: string) {
    await this.redis.hset(this.getScopedKey(projectId, 'runbooks'), runbook.id, JSON.stringify(runbook));
  }

  // --- V5 Service Registry ---
  async getServices(projectId?: string): Promise<Service[]> {
    const rawList = await this.redis.hvals(this.getScopedKey(projectId, 'services'));
    return rawList.map(item => JSON.parse(item));
  }

  async getService(id: string, projectId?: string): Promise<Service | null> {
    const raw = await this.redis.hget(this.getScopedKey(projectId, 'services'), id);
    return raw ? JSON.parse(raw) : null;
  }

  async saveService(service: Service, projectId?: string) {
    await this.redis.hset(this.getScopedKey(projectId, 'services'), service.id, JSON.stringify(service));
  }

  async deleteService(id: string, projectId?: string) {
    await this.redis.hdel(this.getScopedKey(projectId, 'services'), id);
  }

  async getEnvironments(projectId?: string): Promise<Environment[]> {
    const rawList = await this.redis.hvals(this.getScopedKey(projectId, 'environments'));
    return rawList.map(item => JSON.parse(item));
  }

  async saveEnvironment(env: Environment, projectId?: string) {
    await this.redis.hset(this.getScopedKey(projectId, 'environments'), env.name, JSON.stringify(env));
  }

  // --- V5 Dependency Graph ---
  async getDependencyGraph(projectId?: string): Promise<DependencyGraph> {
    const raw = await this.redis.get(this.getScopedKey(projectId, 'dependency_graph'));
    if (raw) return JSON.parse(raw);
    return { nodes: [], edges: [], serviceImpacts: {} };
  }

  async saveDependencyGraph(graph: DependencyGraph, projectId?: string) {
    await this.redis.set(this.getScopedKey(projectId, 'dependency_graph'), JSON.stringify(graph));
  }

  // --- V5 Reliability Scores ---
  async getReliabilityScores(projectId?: string): Promise<ReliabilityScore[]> {
    const rawList = await this.redis.hvals(this.getScopedKey(projectId, 'reliability_scores'));
    return rawList.map(item => JSON.parse(item));
  }

  async saveReliabilityScore(score: ReliabilityScore, projectId?: string) {
    const key = this.getScopedKey(projectId, 'reliability_scores');
    await this.redis.hset(key, `${score.targetType}:${score.targetId}`, JSON.stringify(score));
    const histKey = this.getScopedKey(projectId, `reliability_history:${score.targetId}`);
    await this.redis.lpush(histKey, JSON.stringify(score));
    await this.redis.ltrim(histKey, 0, 99);
  }

  async getReliabilityHistory(targetId: string, projectId?: string): Promise<ReliabilityScore[]> {
    const list = await this.redis.lrange(this.getScopedKey(projectId, `reliability_history:${targetId}`), 0, -1);
    return list.map(item => JSON.parse(item));
  }

  // --- V5 Predictions ---
  async getPredictions(projectId?: string): Promise<Prediction[]> {
    const rawList = await this.redis.hvals(this.getScopedKey(projectId, 'predictions'));
    return rawList.map(item => JSON.parse(item)).sort((a, b) => b.timestamp - a.timestamp);
  }

  async getPrediction(id: string, projectId?: string): Promise<Prediction | null> {
    const raw = await this.redis.hget(this.getScopedKey(projectId, 'predictions'), id);
    return raw ? JSON.parse(raw) : null;
  }

  async savePrediction(pred: Prediction, projectId?: string) {
    await this.redis.hset(this.getScopedKey(projectId, 'predictions'), pred.id, JSON.stringify(pred));
  }

  // ─── Retention Policy Storage ────────────────────────────────────────────────

  async getRetentionPolicy(projectId: string): Promise<RetentionPolicy | null> {
    const raw = await this.redis.get(`queuewatch:retention:${projectId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async saveRetentionPolicy(projectId: string, policy: RetentionPolicy): Promise<void> {
    await this.redis.set(`queuewatch:retention:${projectId}`, JSON.stringify(policy));
  }

  // ─── Incident deletion (used by retention purge) ──────────────────────────

  async deleteIncident(incidentId: string, projectId?: string): Promise<void> {
    await this.redis.hdel(this.getScopedKey(projectId, 'incidents'), incidentId);
    await this.deleteIncidentTimeline(incidentId, projectId);
  }

  async deleteInvestigation(incidentId: string, projectId?: string): Promise<void> {
    await this.redis.del(this.getScopedKey(projectId, `investigations:${incidentId}`));
  }

  // ─── Count helpers (for retention UI usage stats) ─────────────────────────

  async countTelemetry(projectId: string): Promise<number> {
    return this.redis.llen(this.getScopedKey(projectId, 'telemetry'));
  }

  async countLogs(projectId: string): Promise<number> {
    return this.redis.llen(this.getScopedKey(projectId, 'logs'));
  }
}
