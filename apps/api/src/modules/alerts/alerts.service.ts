import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { AlertRule, AlertNotification } from '@queuewatch/shared';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly dbService: DbService,
    private readonly wsGateway: QueueWebSocketGateway
  ) {}

  async getRules(): Promise<AlertRule[]> {
    return this.dbService.getAlertRules();
  }

  async getRule(id: string): Promise<AlertRule | null> {
    return this.dbService.getAlertRule(id);
  }

  async saveRule(rule: AlertRule): Promise<AlertRule> {
    await this.dbService.saveAlertRule(rule);
    return rule;
  }

  async deleteRule(id: string): Promise<void> {
    await this.dbService.deleteAlertRule(id);
  }

  async getNotifications(limit = 50): Promise<AlertNotification[]> {
    return this.dbService.getAlertNotifications(limit);
  }

  /**
   * Evaluates rules against live metrics and triggers alerts accordingly.
   */
  async evaluateRules(metricsList: any[]) {
    const rules = await this.getRules();
    const enabledRules = rules.filter(r => r.enabled);

    for (const rule of enabledRules) {
      const metricVal = metricsList.find(m => m.queueName === rule.queueName);
      if (!metricVal) continue;

      let valueToEvaluate = 0;
      switch (rule.metric) {
        case 'failureRate':
          valueToEvaluate = metricVal.failureRate || 0;
          break;
        case 'retryRate':
          valueToEvaluate = metricVal.retryRate || 0;
          break;
        case 'backlog':
          valueToEvaluate = metricVal.waitingCount || 0;
          break;
        case 'avgLatency':
          valueToEvaluate = metricVal.averageLatency || 0;
          break;
        case 'deadLetterCount':
          valueToEvaluate = metricVal.deadLetterCount || 0;
          break;
        case 'workerHealthScore':
          valueToEvaluate = metricVal.workerHealthScore || 0;
          break;
      }

      let triggered = false;
      if (rule.operator === '>') triggered = valueToEvaluate > rule.threshold;
      else if (rule.operator === '<') triggered = valueToEvaluate < rule.threshold;
      else if (rule.operator === '==') triggered = valueToEvaluate === rule.threshold;

      if (triggered) {
        const message = `Alert Rule [${rule.name}] Triggered! Queue: ${rule.queueName}. Metric ${rule.metric} evaluates to ${valueToEvaluate} (threshold: ${rule.threshold})`;
        this.logger.warn(`[Alert] ${message}`);

        // Persist Notification
        const notification: AlertNotification = {
          id: `al_${Math.random().toString(36).substr(2, 9)}`,
          ruleId: rule.id,
          message,
          timestamp: Date.now(),
        };

        await this.dbService.saveAlertNotification(notification);

        // Broadcast alert
        this.wsGateway.broadcast('alert.triggered', notification);

        // Placeholder Loggers for Integrations
        this.dispatchSlackNotification(rule.name, message);
        this.dispatchEmailNotification(rule.name, message);
      }
    }
  }

  private dispatchSlackNotification(ruleName: string, text: string) {
    this.logger.debug(`[Slack Notification Integration Placeholder] Triggered: ${ruleName} -> "${text}"`);
  }

  private dispatchEmailNotification(ruleName: string, text: string) {
    this.logger.debug(`[Email Notification Integration Placeholder] Triggered: ${ruleName} -> "${text}"`);
  }
}
