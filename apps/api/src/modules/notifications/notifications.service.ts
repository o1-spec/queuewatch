import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { DbService } from '../db/db.service';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';
import { Incident, Notification, NotificationSetting } from '@queuewatch/shared';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly dbService: DbService,
    private readonly wsGateway: QueueWebSocketGateway
  ) {}

  onModuleInit() {
    this.initMailTransporter();
  }

  private initMailTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT') || 587;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const from = this.configService.get<string>('SMTP_FROM') || 'noreply@queuewatch.io';
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';

    if (!host || !user || !pass) {
      this.logger.warn(
        '⚠️ SMTP host, user or password config missing. Nodemailer email alerts will be disabled.'
      );
      this.transporter = null;
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      });
      this.logger.log(`SMTP Nodemailer transport configured successfully to ${host}:${port}.`);
    } catch (e) {
      this.logger.error('Failed to initialize Nodemailer SMTP transporter:', e);
      this.transporter = null;
    }
  }

  async sendIncidentAlert(incident: Incident, isEscalation = false) {
    const settings = await this.dbService.getNotificationSettings('admin');
    
    // Check severity filters
    if (settings.severities && !settings.severities.includes(incident.severity)) {
      this.logger.log(`Skipping notification for ${incident.id}: severity ${incident.severity} filtered out.`);
      return;
    }

    // Check queue filters
    if (settings.queues && !settings.queues.includes(incident.affectedQueue)) {
      this.logger.log(`Skipping notification for ${incident.id}: queue ${incident.affectedQueue} filtered out.`);
      return;
    }

    const typePrefix = isEscalation ? '🚨 [ESCALATION]' : '⚠️ [ALERT]';
    const alertMessage = `${typePrefix} Incident #${incident.id} on queue [${incident.affectedQueue}] status: ${incident.status.toUpperCase()}. Title: ${incident.title}`;

    // 1. Dashboard notification
    if (settings.dashboardEnabled) {
      const notif: Notification = {
        id: `notif_${Math.random().toString(36).substr(2, 9)}`,
        incidentId: incident.id,
        message: alertMessage,
        severity: incident.severity,
        queueName: incident.affectedQueue,
        channel: 'dashboard',
        status: 'sent',
        timestamp: Date.now(),
      };
      await this.dbService.saveNotification(notif);
      this.wsGateway.broadcast('notification.created', notif);
    }

    // 2. Email notification
    if (settings.emailEnabled) {
      if (this.transporter) {
        try {
          const from = this.configService.get<string>('SMTP_FROM') || 'noreply@queuewatch.io';
          const toAddress = 'admin@queuewatch.io'; // default alert recipient

          const htmlContent = `
            <div style="font-family: monospace; padding: 20px; background-color: #0c0a09; color: #e7e5e4; border: 1px solid #27272a; max-width: 600px;">
              <h2 style="color: #f43f5e; border-bottom: 1px solid #27272a; padding-bottom: 10px; text-transform: uppercase;">
                ${isEscalation ? '🔥 QueueWatch Escalation Triggered' : '🚨 QueueWatch Incident Alert'}
              </h2>
              <table style="width: 100%; text-align: left; margin-bottom: 20px; font-size: 12px;">
                <tr><th style="color: #a8a29e;">Incident ID:</th><td><b>${incident.id}</b></td></tr>
                <tr><th style="color: #a8a29e;">Title:</th><td><b>${incident.title}</b></td></tr>
                <tr><th style="color: #a8a29e;">Severity:</th><td style="color: #f43f5e;"><b>${incident.severity.toUpperCase()}</b></td></tr>
                <tr><th style="color: #a8a29e;">Queue Name:</th><td><code>${incident.affectedQueue}</code></td></tr>
                <tr><th style="color: #a8a29e;">Detected At:</th><td>${new Date(incident.firstDetectedAt).toLocaleString()}</td></tr>
              </table>
              <div style="background-color: #1c1917; border: 1px solid #27272a; padding: 12px; margin-bottom: 15px; font-size: 11px;">
                <p><b>Suspected Root Cause:</b><br/>${incident.suspectedRootCause}</p>
                <p><b>Impact:</b><br/>${incident.impact}</p>
                <p><b>Remediation Recommendation:</b><br/>${incident.recommendation}</p>
              </div>
              <a href="http://localhost:3000/incidents" style="display: inline-block; padding: 8px 16px; background-color: #6366f1; color: white; text-decoration: none; font-weight: bold; font-size: 11px; border-radius: 4px;">
                OPEN DIAGNOSTICS WORKSPACE
              </a>
            </div>
          `;

          await this.transporter.sendMail({
            from,
            to: toAddress,
            subject: `${isEscalation ? '🔥 [ESCALATED]' : '🚨 [ALERT]'} ${incident.title}`,
            html: htmlContent,
          });

          this.logger.log(`Email alert successfully sent to ${toAddress} for incident ${incident.id}.`);
        } catch (e) {
          this.logger.error(`Failed to send email alert for incident ${incident.id}:`, e);
          await this.dbService.saveNotification({
            id: `notif_${Math.random().toString(36).substr(2, 9)}`,
            incidentId: incident.id,
            message: `Email alert dispatch failed: ${e.message}`,
            channel: 'email',
            status: 'failed',
            timestamp: Date.now(),
          });
        }
      } else {
        this.logger.warn('SMTP transporter not initialized. Email alert skipped.');
      }
    }

    // 3. Webhooks integration (Slack & Discord)
    if (settings.webhookEnabled) {
      if (settings.slackWebhookUrl) {
        await this.postToWebhook(settings.slackWebhookUrl, {
          text: `🚨 *[QueueWatch]* ${isEscalation ? '*ESCALATED INCIDENT*' : '*NEW INCIDENT*'} \n*ID:* ${incident.id}\n*Title:* ${incident.title}\n*Queue:* \`${incident.affectedQueue}\`\n*Severity:* \`${incident.severity.toUpperCase()}\`\n*Root Cause:* ${incident.suspectedRootCause}\n<http://localhost:3000/incidents|Open Dashboard>`,
        }, 'slack_webhook');
      }

      if (settings.discordWebhookUrl) {
        await this.postToWebhook(settings.discordWebhookUrl, {
          content: `🚨 **[QueueWatch]** ${isEscalation ? '**ESCALATED INCIDENT**' : '**NEW INCIDENT**'}\n**ID:** \`${incident.id}\`\n**Title:** *${incident.title}*\n**Queue:** \`${incident.affectedQueue}\`\n**Severity:** \`${incident.severity.toUpperCase()}\`\n**Root Cause:** ${incident.suspectedRootCause}\n[Open Dashboard](http://localhost:3000/incidents)`,
        }, 'discord_webhook');
      }
    }
  }

  private async postToWebhook(url: string, payload: any, channel: 'slack_webhook' | 'discord_webhook') {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Webhook responded with status ${res.status}`);
      }

      this.logger.log(`Successfully dispatched webhook notification to ${channel} channel.`);
      
      const notif: Notification = {
        id: `notif_${Math.random().toString(36).substr(2, 9)}`,
        message: `Webhook alert dispatched successfully to ${channel}.`,
        channel,
        status: 'sent',
        timestamp: Date.now(),
      };
      await this.dbService.saveNotification(notif);
    } catch (e) {
      this.logger.error(`Webhook post failed to ${channel}:`, e.message);
      
      // Soft retry mechanism
      try {
        this.logger.warn(`Retrying webhook delivery once to ${channel}...`);
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (retryErr) {
        this.logger.error(`Webhook retry also failed:`, retryErr.message);
        const notif: Notification = {
          id: `notif_${Math.random().toString(36).substr(2, 9)}`,
          message: `Webhook dispatch failed: ${retryErr.message}`,
          channel,
          status: 'failed',
          timestamp: Date.now(),
        };
        await this.dbService.saveNotification(notif);
      }
    }
  }

  async getSettings(): Promise<NotificationSetting> {
    return this.dbService.getNotificationSettings('admin');
  }

  async saveSettings(settings: NotificationSetting): Promise<NotificationSetting> {
    await this.dbService.saveNotificationSettings('admin', settings);
    // Reconfigure mail transporter if SMTP properties changed
    this.initMailTransporter();
    return settings;
  }

  async getNotifications(limit = 100): Promise<Notification[]> {
    return this.dbService.getNotifications(limit);
  }
}
