import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { 
  User, Incident, TelemetryEvent, LogEntry, AlertRule, AlertNotification, 
  InvestigationReport, DeadLetterJob, IncidentComment, NotificationSetting, 
  EscalationRule, DeploymentEvent, Notification 
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
}
