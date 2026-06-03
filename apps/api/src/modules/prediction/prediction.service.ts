import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { Prediction } from '@queuewatch/shared';

@Injectable()
export class PredictionService {
  private readonly logger = new Logger(PredictionService.name);

  constructor(private readonly dbService: DbService) {}

  async getLatestPredictions(): Promise<Prediction[]> {
    // Run deterministic rules dynamically to populate predictions
    await this.generateHeuristicPredictions();
    return this.dbService.getPredictions();
  }

  async getPredictionById(id: string): Promise<Prediction | null> {
    return this.dbService.getPrediction(id);
  }

  private async generateHeuristicPredictions(): Promise<void> {
    try {
      const telemetry = await this.dbService.getTelemetry(100);
      const workers = await this.dbService.getWorkers();
      const incidents = await this.dbService.getIncidents();
      const queueNames = ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'];

      for (const queue of queueNames) {
        const queueTelemetry = telemetry.filter(t => t.queueName === queue);
        const activeIncidents = incidents.filter(i => i.affectedQueue === queue && i.status !== 'resolved');
        
        // 1. Backlog saturation rule
        const createdCount = queueTelemetry.filter(t => t.type === 'job.created').length;
        const completedCount = queueTelemetry.filter(t => t.type === 'job.completed').length;
        const netGrowth = createdCount - completedCount;

        if (netGrowth > 5) {
          const riskScore = Math.min(95, 40 + netGrowth * 5);
          const pred: Prediction = {
            id: `pred_backlog_${queue}`,
            title: `Queue Backlog Accumulation Risk: ${queue}`,
            riskScore,
            confidenceScore: 80,
            estimatedImpact: `Queue backlog is accumulating. Processing latency will increase by ~${netGrowth * 2} minutes.`,
            recommendedActions: [
              `Pause producers on '${queue}' using simulation sandbox`,
              'Increase worker replica counts to speed up consumption'
            ],
            reason: `Job production rate (${createdCount}/min) exceeds worker consumption rate (${completedCount}/min).`,
            targetQueue: queue,
            timestamp: Date.now()
          };
          await this.dbService.savePrediction(pred);
        }

        // 2. Worker health degradation rule
        const queueWorkers = workers.filter(w => w.queueName === queue);
        const unhealthyWorkers = queueWorkers.filter(w => w.status !== 'healthy');
        if (unhealthyWorkers.length > 0) {
          const pred: Prediction = {
            id: `pred_worker_${queue}`,
            title: `Worker Resource Contention on ${queue}`,
            riskScore: 70,
            confidenceScore: 90,
            estimatedImpact: `Unprocessed jobs will stall, triggering retries and increasing queue delay jitter.`,
            recommendedActions: [
              'Audit worker heap snapshots for memory leaks',
              'Verify redis connectivity socket timeouts'
            ],
            reason: `${unhealthyWorkers.length} worker consumers are reporting status '${unhealthyWorkers[0].status}'.`,
            targetQueue: queue,
            timestamp: Date.now()
          };
          await this.dbService.savePrediction(pred);
        }
      }
    } catch (e) {
      this.logger.error('Failed to run deterministic SRE prediction rules:', e);
    }
  }
}
