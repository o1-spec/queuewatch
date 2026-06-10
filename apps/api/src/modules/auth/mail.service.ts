import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initMailTransporter();
  }

  private initMailTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT') || 587;
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const secure = this.configService.get<string>('SMTP_SECURE') === 'true';

    if (!host || !user || !pass) {
      this.logger.warn(
        '⚠️ SMTP host, user, or password configuration is missing. Nodemailer auth emails will be logged to the console instead.'
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
      this.logger.log(`SMTP transporter initialized successfully to ${host}:${port}.`);
    } catch (error: any) {
      this.logger.error('Failed to initialize Nodemailer SMTP transporter:', error);
      this.transporter = null;
    }
  }

  async sendWelcomeEmail(email: string, name: string) {
    const fromAddress = this.configService.get<string>('SMTP_FROM') || 'noreply@queuewatch.dev';
    const appUrl = this.configService.get<string>('API_URL') || 'http://localhost:3001';
    // Replace port 3001 with 3000 for frontend link in emails
    const frontendUrl = appUrl.replace(':3001', ':3000');
    const subject = 'Welcome to QueueWatch - Operational Diagnostics Platform';

    const htmlContent = `
      <div style="font-family: monospace; padding: 24px; background-color: #09090b; color: #d4d4d8; border: 1px solid #27272a; max-width: 600px; margin: 0 auto; line-height: 1.6;">
        <div style="display: flex; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #27272a; padding-bottom: 16px;">
          <div style="width: 28px; height: 28px; background-color: #e4e4e7; color: #09090b; display: flex; align-items: center; justify-content: center; font-weight: bold; border-radius: 4px; font-size: 16px; margin-right: 12px; font-family: monospace;">Q</div>
          <div>
            <h2 style="margin: 0; font-size: 18px; color: #ffffff; letter-spacing: 0.05em; font-family: monospace;">QueueWatch</h2>
            <p style="margin: 0; font-size: 9px; color: #71717a; text-transform: uppercase; letter-spacing: 0.15em; font-weight: bold;">Telemetry Engine</p>
          </div>
        </div>
        
        <p style="font-size: 13px; margin-top: 0;">Welcome, SRE Operator <strong>${name}</strong>.</p>
        
        <p style="font-size: 12px;">Your QueueWatch account has been successfully provisioned. You now have access to our real-time operational diagnostics platform for monitoring background queues, worker performance, and dead-letter queues.</p>
        
        <div style="background-color: #18181b; border: 1px solid #27272a; padding: 16px; border-radius: 4px; margin: 20px 0; font-size: 11px;">
          <h4 style="margin: 0 0 8px 0; color: #ffffff; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Console Access Details</h4>
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <tr><td style="color: #71717a; padding: 4px 0; width: 120px;">Operator Name:</td><td style="color: #ffffff;">${name}</td></tr>
            <tr><td style="color: #71717a; padding: 4px 0;">Work Email:</td><td style="color: #ffffff;">${email}</td></tr>
            <tr><td style="color: #71717a; padding: 4px 0;">Telemetry Node:</td><td style="color: #6366f1;">active-node-1</td></tr>
          </table>
        </div>
        
        <p style="font-size: 12px;">Please proceed to your administrator console to create or manage your background processing channels.</p>
        
        <div style="margin: 24px 0 16px 0; text-align: center;">
          <a href="${frontendUrl}/login" style="display: inline-block; padding: 10px 20px; background-color: #ffffff; color: #09090b; text-decoration: none; font-weight: bold; font-size: 12px; border-radius: 4px; border: 1px solid #e4e4e7; font-family: monospace;">
            ACCESS OPERATOR PANEL →
          </a>
        </div>
        
        <div style="border-top: 1px solid #27272a; padding-top: 16px; margin-top: 24px; font-size: 10px; color: #52525b; text-align: center;">
          This is an automated system notification from QueueWatch Engine. Please do not reply directly.
        </div>
      </div>
    `;

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: `QueueWatch <${fromAddress}>`,
          to: email,
          subject,
          html: htmlContent,
        });
        this.logger.log(`Welcome email successfully sent to ${email}.`);
      } catch (error: any) {
        this.logger.error(`Failed to send welcome email to ${email}:`, error);
      }
    } else {
      this.logger.log(`
[MAIL FALLBACK] Welcome Email logged for ${email} (${name}):
-----------------------------------------------------------------
Subject: ${subject}
Message: Hello ${name}, your QueueWatch SRE operator account has been created.
Access Link: ${frontendUrl}/login
-----------------------------------------------------------------
      `);
    }
  }

  async sendOtpEmail(email: string, name: string, otpCode: string) {
    const fromAddress = this.configService.get<string>('SMTP_FROM') || 'noreply@queuewatch.dev';
    const subject = 'QueueWatch - Access Key Reset Request';

    const htmlContent = `
      <div style="font-family: monospace; padding: 24px; background-color: #09090b; color: #d4d4d8; border: 1px solid #27272a; max-width: 600px; margin: 0 auto; line-height: 1.6;">
        <div style="display: flex; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #27272a; padding-bottom: 16px;">
          <div style="width: 28px; height: 28px; background-color: #f43f5e; color: #09090b; display: flex; align-items: center; justify-content: center; font-weight: bold; border-radius: 4px; font-size: 16px; margin-right: 12px; font-family: monospace;">Q</div>
          <div>
            <h2 style="margin: 0; font-size: 18px; color: #ffffff; letter-spacing: 0.05em; font-family: monospace;">QueueWatch</h2>
            <p style="margin: 0; font-size: 9px; color: #71717a; text-transform: uppercase; letter-spacing: 0.15em; font-weight: bold;">Telemetry Engine</p>
          </div>
        </div>
        
        <p style="font-size: 13px; margin-top: 0;">Attention: SRE Operator <strong>${name}</strong>.</p>
        
        <p style="font-size: 12px;">We received a request to reset your security access key password. Use the verification OTP code below to configure a new access key. This code is active for <strong>10 minutes</strong>.</p>
        
        <div style="background-color: #1c1917; border: 1px solid #dc2626; padding: 20px; border-radius: 4px; margin: 20px 0; text-align: center;">
          <span style="font-size: 10px; color: #f87171; text-transform: uppercase; font-weight: bold; letter-spacing: 0.1em; display: block; margin-bottom: 8px;">Security Recovery OTP</span>
          <span style="font-size: 28px; color: #ffffff; letter-spacing: 0.25em; font-weight: bold; font-family: monospace; display: block;">${otpCode}</span>
        </div>
        
        <p style="font-size: 11px; color: #a1a1aa;">If you did not initiate this reset request, you can safely ignore this email. Your current access key remains active and unchanged.</p>
        
        <div style="border-top: 1px solid #27272a; padding-top: 16px; margin-top: 24px; font-size: 10px; color: #52525b; text-align: center;">
          This is an automated system notification from QueueWatch Engine. Please do not reply directly.
        </div>
      </div>
    `;

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from: `QueueWatch Security <${fromAddress}>`,
          to: email,
          subject,
          html: htmlContent,
        });
        this.logger.log(`Recovery OTP email successfully sent to ${email}.`);
      } catch (error: any) {
        this.logger.error(`Failed to send recovery OTP email to ${email}:`, error);
      }
    } else {
      this.logger.log(`
[MAIL FALLBACK] Recovery OTP logged for ${email} (${name}):
-----------------------------------------------------------------
Subject: ${subject}
OTP Code: ${otpCode}
Expiration: 10 Minutes
-----------------------------------------------------------------
      `);
    }
  }

  async sendContactEmails(email: string, message: string) {
    const fromAddress = this.configService.get<string>('SMTP_FROM') || 'support@queuewatch.dev';
    const ticketId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;

    const userHtml = `
      <div style="font-family: monospace; padding: 24px; background-color: #09090b; color: #d4d4d8; border: 1px solid #27272a; max-width: 600px; margin: 0 auto; line-height: 1.6;">
        <div style="display: flex; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #27272a; padding-bottom: 16px;">
          <div style="width: 28px; height: 28px; background-color: #e4e4e7; color: #09090b; display: flex; align-items: center; justify-content: center; font-weight: bold; border-radius: 4px; font-size: 16px; margin-right: 12px; font-family: monospace;">Q</div>
          <div>
            <h2 style="margin: 0; font-size: 18px; color: #ffffff; letter-spacing: 0.05em; font-family: monospace;">QueueWatch</h2>
            <p style="margin: 0; font-size: 9px; color: #71717a; text-transform: uppercase; letter-spacing: 0.15em; font-weight: bold;">Telemetry Support</p>
          </div>
        </div>
        
        <p style="font-size: 13px; margin-top: 0;">Hello,</p>
        
        <p style="font-size: 12px;">We have successfully received your support query. A member of the QueueWatch reliability operations team will review your ticket (ID: <strong>${ticketId}</strong>) and follow up shortly.</p>
        
        <div style="background-color: #18181b; border: 1px solid #27272a; padding: 16px; border-radius: 4px; margin: 20px 0; font-size: 11px;">
          <h4 style="margin: 0 0 8px 0; color: #ffffff; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Transmission Log Copy</h4>
          <div style="white-space: pre-wrap; color: #a1a1aa; line-height: 1.5; font-family: monospace;">${message}</div>
        </div>
        
        <div style="border-top: 1px solid #27272a; padding-top: 16px; margin-top: 24px; font-size: 10px; color: #52525b; text-align: center;">
          This is an automated receipt confirmation from QueueWatch.
        </div>
      </div>
    `;

    const adminHtml = `
      <div style="font-family: monospace; padding: 24px; background-color: #09090b; color: #d4d4d8; border: 1px solid #27272a; max-width: 600px; margin: 0 auto; line-height: 1.6;">
        <div style="display: flex; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #f43f5e; padding-bottom: 16px;">
          <div style="width: 28px; height: 28px; background-color: #f43f5e; color: #09090b; display: flex; align-items: center; justify-content: center; font-weight: bold; border-radius: 4px; font-size: 16px; margin-right: 12px; font-family: monospace;">Q</div>
          <div>
            <h2 style="margin: 0; font-size: 18px; color: #ffffff; letter-spacing: 0.05em; font-family: monospace;">QueueWatch Support</h2>
            <p style="margin: 0; font-size: 9px; color: #f43f5e; text-transform: uppercase; letter-spacing: 0.15em; font-weight: bold;">New Inbound Query</p>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 20px; font-size: 12px;">
          <tr><td style="color: #71717a; padding: 4px 0; width: 120px;">Ticket ID:</td><td style="color: #ffffff;"><strong>${ticketId}</strong></td></tr>
          <tr><td style="color: #71717a; padding: 4px 0;">From Operator:</td><td style="color: #ffffff;">${email}</td></tr>
          <tr><td style="color: #71717a; padding: 4px 0;">Received At:</td><td style="color: #ffffff;">${new Date().toLocaleString()}</td></tr>
        </table>
        
        <div style="background-color: #18181b; border: 1px solid #27272a; padding: 16px; border-radius: 4px; font-size: 11px;">
          <h4 style="margin: 0 0 8px 0; color: #ffffff; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">Query Payload</h4>
          <div style="white-space: pre-wrap; color: #d4d4d8; line-height: 1.5; font-family: monospace;">${message}</div>
        </div>
      </div>
    `;

    if (this.transporter) {
      try {
        // Send receipt to operator
        await this.transporter.sendMail({
          from: `QueueWatch Support <${fromAddress}>`,
          to: email,
          subject: `QueueWatch Support - Request Received [${ticketId}]`,
          html: userHtml,
        });
        this.logger.log(`Support confirmation receipt sent to ${email} for ticket ${ticketId}.`);
      } catch (error: any) {
        this.logger.error(`Failed to send support confirmation receipt to ${email}:`, error);
      }

      try {
        // Send notification to support team
        await this.transporter.sendMail({
          from: `QueueWatch System <${fromAddress}>`,
          to: fromAddress, // admin inbox
          subject: `[SUPPORT TICKET] ${ticketId} from ${email}`,
          html: adminHtml,
        });
        this.logger.log(`Support ticket notification dispatched to admin (${fromAddress}) for ticket ${ticketId}.`);
      } catch (error: any) {
        this.logger.error(`Failed to dispatch support ticket notification to admin:`, error);
      }
    } else {
      this.logger.log(`
[MAIL FALLBACK] Contact Support Query Logged (transporter missing):
-----------------------------------------------------------------
Ticket ID: ${ticketId}
Operator: ${email}
Admin Dest: ${fromAddress}
Message:
${message}
-----------------------------------------------------------------
      `);
    }
  }
}
