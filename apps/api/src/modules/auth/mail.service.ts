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
    const subject = 'Welcome to QueueWatch 👋';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 40px; background-color: #ffffff; color: #27272a; max-width: 560px; margin: 0 auto; line-height: 1.6; border: 1px solid #e4e4e7; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
        <!-- Header / Logo -->
        <div style="margin-bottom: 32px; text-align: left; border-bottom: 1px solid #e4e4e7; padding-bottom: 20px;">
          <div style="font-size: 20px; font-weight: 800; color: #09090b; letter-spacing: -0.03em; display: inline-flex; align-items: center; line-height: 1;">
            <span style="background: linear-gradient(135deg, #09090b 0%, #27272a 100%); color: #ffffff; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; margin-right: 10px; font-weight: 900; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Q</span>
            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">QueueWatch</span>
          </div>
          <div style="font-size: 12px; color: #71717a; font-weight: 500; margin-top: 6px; letter-spacing: -0.01em;">
            Operational Intelligence for Modern Systems
          </div>
        </div>
        
        <!-- Title -->
        <h2 style="font-size: 22px; font-weight: 700; color: #09090b; margin-top: 0; margin-bottom: 20px; letter-spacing: -0.03em;">Welcome to QueueWatch 👋</h2>
        
        <!-- Body -->
        <p style="font-size: 14px; color: #3f3f46; margin-bottom: 16px;">Hi ${name},</p>
        <p style="font-size: 14px; color: #3f3f46; margin-bottom: 16px;">Thanks for creating your QueueWatch account.</p>
        <p style="font-size: 14px; color: #3f3f46; margin-bottom: 16px;">You're now ready to start monitoring your systems, investigate operational incidents, and gain visibility into background workloads and distributed services.</p>
        
        <p style="font-size: 14px; font-weight: 600; color: #09090b; margin-top: 24px; margin-bottom: 12px;">To get started:</p>
        <ol style="font-size: 14px; color: #3f3f46; padding-left: 20px; margin-bottom: 24px; line-height: 1.8;">
          <li>Create your first project</li>
          <li>Generate an API key</li>
          <li>Install the QueueWatch SDK</li>
          <li>Begin streaming telemetry</li>
        </ol>
        
        <p style="font-size: 14px; color: #3f3f46; margin-bottom: 24px;">Once QueueWatch receives telemetry, your dashboard will automatically populate with operational insights, worker health, queue metrics, and incident diagnostics.</p>
        
        <!-- Button -->
        <div style="margin: 32px 0; text-align: left;">
          <a href="${frontendUrl}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #09090b; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 6px;">
            Go to Dashboard
          </a>
        </div>
        
        <!-- Footer -->
        <div style="border-top: 1px solid #e4e4e7; padding-top: 24px; margin-top: 32px; font-size: 13px; color: #71717a;">
          <p style="margin: 0 0 8px 0;">Questions? Contact <a href="mailto:support@queuewatch.dev" style="color: #09090b; font-weight: 500; text-decoration: underline;">support@queuewatch.dev</a></p>
          <p style="margin: 0; font-size: 12px; color: #a1a1aa;">&copy; 2026 QueueWatch</p>
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
Message: Hello ${name}, welcome to QueueWatch.
Access Link: ${frontendUrl}/dashboard
-----------------------------------------------------------------
      `);
    }
  }

  async sendOtpEmail(email: string, name: string, otpCode: string) {
    const fromAddress = this.configService.get<string>('SMTP_FROM') || 'noreply@queuewatch.dev';
    const appUrl = this.configService.get<string>('API_URL') || 'http://localhost:3001';
    const frontendUrl = appUrl.replace(':3001', ':3000');
    const subject = 'Reset your QueueWatch password';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 40px; background-color: #ffffff; color: #27272a; max-width: 560px; margin: 0 auto; line-height: 1.6; border: 1px solid #e4e4e7; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
        <!-- Header / Logo -->
        <div style="margin-bottom: 32px; text-align: left; border-bottom: 1px solid #e4e4e7; padding-bottom: 20px;">
          <div style="font-size: 20px; font-weight: 800; color: #09090b; letter-spacing: -0.03em; display: inline-flex; align-items: center; line-height: 1;">
            <span style="background: linear-gradient(135deg, #09090b 0%, #27272a 100%); color: #ffffff; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; margin-right: 10px; font-weight: 900; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Q</span>
            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">QueueWatch</span>
          </div>
          <div style="font-size: 12px; color: #71717a; font-weight: 500; margin-top: 6px; letter-spacing: -0.01em;">
            Operational Intelligence for Modern Systems
          </div>
        </div>
        
        <!-- Title -->
        <h2 style="font-size: 22px; font-weight: 700; color: #09090b; margin-top: 0; margin-bottom: 20px; letter-spacing: -0.03em;">Password Reset Request</h2>
        
        <!-- Body -->
        <p style="font-size: 14px; color: #3f3f46; margin-bottom: 16px;">Hi ${name},</p>
        <p style="font-size: 14px; color: #3f3f46; margin-bottom: 16px;">We received a request to reset your QueueWatch password.</p>
        <p style="font-size: 14px; color: #3f3f46; margin-bottom: 20px;">Use the verification code below to continue:</p>
        
        <!-- Large Centered Code -->
        <div style="background-color: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0; border: 1px solid #e4e4e7;">
          <span style="font-size: 36px; font-weight: 800; color: #09090b; letter-spacing: 0.18em; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, monospace; display: block; line-height: 1; margin-left: 0.18em;">${otpCode}</span>
        </div>
        
        <p style="font-size: 13px; color: #71717a; margin-top: 16px; margin-bottom: 24px; font-weight: 550;">This code expires in 10 minutes.</p>
        
        <p style="font-size: 14px; color: #3f3f46; margin-bottom: 24px;">If you didn't request a password reset, you can safely ignore this email.</p>
        
        <!-- Button -->
        <div style="margin: 32px 0; text-align: left;">
          <a href="${frontendUrl}/forgot-password" style="display: inline-block; padding: 12px 24px; background-color: #09090b; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 6px;">
            Reset Password
          </a>
        </div>
        
        <!-- Footer -->
        <div style="border-top: 1px solid #e4e4e7; padding-top: 24px; margin-top: 32px; font-size: 13px; color: #71717a;">
          <p style="margin: 0 0 8px 0;">Questions? Contact <a href="mailto:support@queuewatch.dev" style="color: #09090b; font-weight: 500; text-decoration: underline;">support@queuewatch.dev</a></p>
          <p style="margin: 0; font-size: 12px; color: #a1a1aa;">&copy; 2026 QueueWatch</p>
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

  async sendVerificationEmail(email: string, name: string, verificationCode: string) {
    const fromAddress = this.configService.get<string>('SMTP_FROM') || 'noreply@queuewatch.dev';
    const appUrl = this.configService.get<string>('API_URL') || 'http://localhost:3001';
    const frontendUrl = appUrl.replace(':3001', ':3000');
    const subject = 'Verify your QueueWatch account';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 40px; background-color: #ffffff; color: #27272a; max-width: 560px; margin: 0 auto; line-height: 1.6; border: 1px solid #e4e4e7; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
        <!-- Header / Logo -->
        <div style="margin-bottom: 32px; text-align: left; border-bottom: 1px solid #e4e4e7; padding-bottom: 20px;">
          <div style="font-size: 20px; font-weight: 800; color: #09090b; letter-spacing: -0.03em; display: inline-flex; align-items: center; line-height: 1;">
            <span style="background: linear-gradient(135deg, #09090b 0%, #27272a 100%); color: #ffffff; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; margin-right: 10px; font-weight: 900; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Q</span>
            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">QueueWatch</span>
          </div>
          <div style="font-size: 12px; color: #71717a; font-weight: 500; margin-top: 6px; letter-spacing: -0.01em;">
            Operational Intelligence for Modern Systems
          </div>
        </div>
        
        <!-- Title -->
        <h2 style="font-size: 22px; font-weight: 700; color: #09090b; margin-top: 0; margin-bottom: 20px; letter-spacing: -0.03em;">Verify your QueueWatch account</h2>
        
        <!-- Body -->
        <p style="font-size: 14px; color: #3f3f46; margin-bottom: 16px;">Hi ${name},</p>
        <p style="font-size: 14px; color: #3f3f46; margin-bottom: 16px;">Thanks for signing up for QueueWatch. Please use the verification code below to verify your email address:</p>
        
        <!-- Large Centered Code -->
        <div style="background-color: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0; border: 1px solid #e4e4e7;">
          <span style="font-size: 36px; font-weight: 800; color: #09090b; letter-spacing: 0.18em; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, monospace; display: block; line-height: 1; margin-left: 0.18em;">${verificationCode}</span>
        </div>
        
        <p style="font-size: 14px; color: #3f3f46; margin-bottom: 24px;">or click the button below to verify your account.</p>
        
        <!-- Button -->
        <div style="margin: 32px 0; text-align: left;">
          <a href="${frontendUrl}/verify-email?email=${encodeURIComponent(email)}&code=${verificationCode}" style="display: inline-block; padding: 12px 24px; background-color: #09090b; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; border-radius: 6px;">
            Verify Account
          </a>
        </div>
        
        <!-- Footer -->
        <div style="border-top: 1px solid #e4e4e7; padding-top: 24px; margin-top: 32px; font-size: 13px; color: #71717a;">
          <p style="margin: 0 0 8px 0;">Questions? Contact <a href="mailto:support@queuewatch.dev" style="color: #09090b; font-weight: 500; text-decoration: underline;">support@queuewatch.dev</a></p>
          <p style="margin: 0; font-size: 12px; color: #a1a1aa;">&copy; 2026 QueueWatch</p>
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
        this.logger.log(`Verification email successfully sent to ${email}.`);
      } catch (error: any) {
        this.logger.error(`Failed to send verification email to ${email}:`, error);
      }
    } else {
      this.logger.log(`
[MAIL FALLBACK] Verification Email logged for ${email} (${name}):
-----------------------------------------------------------------
Subject: ${subject}
Verification Code: ${verificationCode}
Link: ${frontendUrl}/verify-email?email=${encodeURIComponent(email)}&code=${verificationCode}
-----------------------------------------------------------------
      `);
    }
  }

  async sendContactEmails(email: string, message: string) {
    const fromAddress = this.configService.get<string>('SMTP_FROM') || 'support@queuewatch.dev';
    const ticketId = `req_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`;

    const userHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 40px; background-color: #ffffff; color: #27272a; max-width: 560px; margin: 0 auto; line-height: 1.6; border: 1px solid #e4e4e7; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
        <!-- Header / Logo -->
        <div style="margin-bottom: 32px; text-align: left; border-bottom: 1px solid #e4e4e7; padding-bottom: 20px;">
          <div style="font-size: 20px; font-weight: 800; color: #09090b; letter-spacing: -0.03em; display: inline-flex; align-items: center; line-height: 1;">
            <span style="background: linear-gradient(135deg, #09090b 0%, #27272a 100%); color: #ffffff; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; margin-right: 10px; font-weight: 900; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Q</span>
            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">QueueWatch</span>
          </div>
          <div style="font-size: 12px; color: #71717a; font-weight: 500; margin-top: 6px; letter-spacing: -0.01em;">
            Operational Intelligence for Modern Systems
          </div>
        </div>
        
        <!-- Title -->
        <h2 style="font-size: 22px; font-weight: 700; color: #09090b; margin-top: 0; margin-bottom: 20px; letter-spacing: -0.03em;">Support Ticket Created</h2>
        
        <!-- Body -->
        <p style="font-size: 14px; color: #3f3f46; margin-bottom: 16px;">Hello,</p>
        <p style="font-size: 14px; color: #3f3f46; margin-bottom: 16px;">We have successfully received your support query. A member of the QueueWatch reliability operations team will review your ticket (ID: <strong>${ticketId}</strong>) and follow up shortly.</p>
        
        <div style="background-color: #f4f4f5; border: 1px solid #e4e4e7; padding: 20px; border-radius: 8px; margin: 24px 0; font-size: 13px;">
          <h4 style="margin: 0 0 8px 0; color: #09090b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, monospace;">Transmission Log Copy</h4>
          <div style="white-space: pre-wrap; color: #52525b; line-height: 1.5; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, monospace; font-size: 12px;">${message}</div>
        </div>
        
        <!-- Footer -->
        <div style="border-top: 1px solid #e4e4e7; padding-top: 24px; margin-top: 32px; font-size: 13px; color: #71717a;">
          <p style="margin: 0 0 8px 0;">Questions? Contact <a href="mailto:support@queuewatch.dev" style="color: #09090b; font-weight: 500; text-decoration: underline;">support@queuewatch.dev</a></p>
          <p style="margin: 0; font-size: 12px; color: #a1a1aa;">&copy; 2026 QueueWatch</p>
        </div>
      </div>
    `;

    const adminHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 40px; background-color: #ffffff; color: #27272a; max-width: 560px; margin: 0 auto; line-height: 1.6; border: 1px solid #e4e4e7; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
        <!-- Header / Logo -->
        <div style="margin-bottom: 32px; text-align: left; border-bottom: 1px solid #e4e4e7; padding-bottom: 20px;">
          <div style="font-size: 20px; font-weight: 800; color: #09090b; letter-spacing: -0.03em; display: inline-flex; align-items: center; line-height: 1;">
            <span style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: #ffffff; width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; margin-right: 10px; font-weight: 900; font-size: 15px; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Q</span>
            <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">QueueWatch Support</span>
          </div>
          <div style="font-size: 12px; color: #ef4444; font-weight: 500; margin-top: 6px; letter-spacing: -0.01em;">
            New Inbound Support Ticket
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; text-align: left; margin-bottom: 24px; font-size: 13px;">
          <tr><td style="color: #71717a; padding: 8px 0; width: 130px; border-bottom: 1px solid #f4f4f5;">Ticket ID:</td><td style="color: #09090b; border-bottom: 1px solid #f4f4f5;"><strong>${ticketId}</strong></td></tr>
          <tr><td style="color: #71717a; padding: 8px 0; border-bottom: 1px solid #f4f4f5;">From Operator:</td><td style="color: #09090b; border-bottom: 1px solid #f4f4f5;">${email}</td></tr>
          <tr><td style="color: #71717a; padding: 8px 0; border-bottom: 1px solid #f4f4f5;">Received At:</td><td style="color: #09090b; border-bottom: 1px solid #f4f4f5;">${new Date().toLocaleString()}</td></tr>
        </table>
        
        <div style="background-color: #f4f4f5; border: 1px solid #e4e4e7; padding: 20px; border-radius: 8px; font-size: 13px;">
          <h4 style="margin: 0 0 8px 0; color: #09090b; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, monospace;">Query Payload</h4>
          <div style="white-space: pre-wrap; color: #27272a; line-height: 1.5; font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Monaco, Consolas, monospace; font-size: 12px;">${message}</div>
        </div>
      </div>
    `;

    if (this.transporter) {
      try {
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
