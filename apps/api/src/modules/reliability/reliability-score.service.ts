import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { ReliabilityScore, QueueMetrics, WorkerHealth, Incident } from '@queuewatch/shared';

@Injectable()
export class ReliabilityScoreService {
  private readonly logger = new Logger(ReliabilityScoreService.name);

  constructor(private readonly dbService: DbService) {}

  async getLatestScores(): Promise<ReliabilityScore[]> {
    const scores = await this.dbService.getReliabilityScores();
    if (scores.length === 0) {
      // Calculate and save initial scores dynamically
      await this.recalculateAllScores();
      return this.dbService.getReliabilityScores();
    }
    return scores;
  }

  async getHistory(targetId: string): Promise<ReliabilityScore[]> {
    return this.dbService.getReliabilityHistory(targetId);
  }

  async recalculateAllScores(): Promise<void> {
    try {
      const incidents = await this.dbService.getIncidents();
      const telemetry = await this.dbService.getTelemetry(100);
      const workers = await this.dbService.getWorkers();

      // We'll calculate scores for our seeded queues
      const queueNames = ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'];
      
      for (const queue of queueNames) {
        // Simple heuristic inputs
        const activeIncidents = incidents.filter(i => i.affectedQueue === queue && i.status !== 'resolved');
        const queueTelemetry = telemetry.filter(t => t.queueName === queue);
        const totalJobs = queueTelemetry.length || 1;
        const failedJobs = queueTelemetry.filter(t => t.type === 'job.failed' || t.type === 'job.deadlettered').length;
        const retries = queueTelemetry.filter(t => t.type === 'job.retried').length;
        
        const failureRate = Math.round((failedJobs / totalJobs) * 100);
        const retryRate = Math.round((retries / totalJobs) * 100);
        const backlogGrowth = Math.max(0, queueTelemetry.filter(t => t.type === 'job.created').length - queueTelemetry.filter(t => t.type === 'job.completed').length);
        
        const queueWorkers = workers.filter(w => w.queueName === queue);
        const healthyWorkers = queueWorkers.filter(w => w.status === 'healthy').length;
        const totalWorkers = queueWorkers.length || 1;
        const workerHealthScore = Math.round((healthyWorkers / totalWorkers) * 100);

        // Deductions
        let score = 100;
        score -= (failureRate * 2);
        score -= (retryRate * 0.5);
        score -= (backlogGrowth * 0.3);
        score -= ((100 - workerHealthScore) * 0.4);
        score -= (activeIncidents.length * 20);
        score = Math.max(10, Math.min(100, Math.round(score)));

        const newScore: ReliabilityScore = {
          id: `score_${queue}_${Date.now()}`,
          targetId: queue,
          targetType: 'queue',
          score,
          failureRate,
          retryRate,
          backlogGrowth,
          workerHealthScore,
          incidentFrequency: activeIncidents.length,
          mttrMinutes: 15, // Mocked MTTR average
          timestamp: Date.now()
        };

        await this.dbService.saveReliabilityScore(newScore);
      }

      // Also calculate for the services based on their linked queues
      const services = await this.dbService.getServices();
      const allScores = await this.dbService.getReliabilityScores();

      for (const svc of services) {
        let scoreSum = 0;
        let count = 0;
        for (const queue of svc.queues) {
          const qScore = allScores.find(s => s.targetId === queue && s.targetType === 'queue');
          if (qScore) {
            scoreSum += qScore.score;
            count++;
          }
        }

        const score = count > 0 ? Math.round(scoreSum / count) : (svc.status === 'healthy' ? 95 : svc.status === 'degraded' ? 65 : 35);
        
        const newScore: ReliabilityScore = {
          id: `score_${svc.id}_${Date.now()}`,
          targetId: svc.id,
          targetType: 'service',
          score,
          failureRate: 0,
          retryRate: 0,
          backlogGrowth: 0,
          workerHealthScore: svc.status === 'healthy' ? 100 : 50,
          incidentFrequency: svc.incidents.length,
          mttrMinutes: 20,
          timestamp: Date.now()
        };

        await this.dbService.saveReliabilityScore(newScore);
      }
    } catch (e) {
      this.logger.error('Failed to recalculate SRE reliability scores:', e);
    }
  }
}
