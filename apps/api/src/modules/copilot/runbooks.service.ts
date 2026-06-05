import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { Runbook } from '@queuewatch/shared';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RunbooksService {
  private readonly logger = new Logger(RunbooksService.name);

  constructor(
    private readonly dbService: DbService,
    private readonly configService: ConfigService
  ) {}

  async getRunbooks(projectId?: string): Promise<Runbook[]> {
    return this.dbService.getRunbooks(projectId);
  }

  async getRunbookById(id: string, projectId?: string): Promise<Runbook> {
    const r = await this.dbService.getRunbook(id, projectId);
    if (!r) throw new NotFoundException(`Runbook ${id} not found`);
    return r;
  }

  async generateRunbook(incidentType: string, linkedIncidents: string[], projectId?: string): Promise<Runbook> {
    const ollamaUrl = this.configService.get<string>('OLLAMA_BASE_URL') || 'http://localhost:11434';
    const model = this.configService.get<string>('OLLAMA_MODEL') || 'llama3.1';
    
    let steps: string[] = [];
    const title = `${incidentType} Outage Recovery Runbook`;

    try {
      this.logger.log(`Generating runbook steps for ${incidentType} via Ollama...`);
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: `You are a Senior Site Reliability Engineer. Output a JSON list of 4-5 recovery steps to restore service stability for a ${incidentType} incident. Only return JSON. Example: ["Step 1", "Step 2"]`,
          stream: false,
          format: 'json',
        }),
      });

      if (response.ok) {
        const body: any = await response.json();
        steps = JSON.parse(body.response || '[]');
      }
    } catch (e) {
      this.logger.warn(`Failed to generate runbook with Ollama: ${e.message}. Using SRE fallback.`);
    }

    if (steps.length === 0) {
      // Fallback
      if (incidentType.toLowerCase().includes('smtp') || incidentType.toLowerCase().includes('email')) {
        steps = [
          'Verify outbound email provider (SendGrid/Mailgun) status page.',
          'Access simulation panel to restrict outbound SMTP call rate.',
          'Reduce queue concurrency settings to throttle tasks.',
          'Replay dead-letter queue jobs for failed notifications.'
        ];
      } else {
        steps = [
          'Inspect telemetry metrics to pinpoint bottleneck queue.',
          'Check recent deployment event logs for possible trigger commits.',
          'Nullify memory buffers, clear caches, and restart worker nodes.',
          'Escalate notifications if failure rates persist above 20%.'
        ];
      }
    }

    const runbook: Runbook = {
      id: `run_${Math.random().toString(36).substr(2, 9)}`,
      incidentType,
      title,
      steps,
      linkedIncidentIds: linkedIncidents,
      createdAt: Date.now(),
    };

    await this.dbService.saveRunbook(runbook, projectId);
    return runbook;
  }
}
