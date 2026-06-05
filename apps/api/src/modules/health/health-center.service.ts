import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { GlobalHealth } from '@queuewatch/shared';

@Injectable()
export class HealthCenterService {
  private readonly logger = new Logger(HealthCenterService.name);

  constructor(private readonly dbService: DbService) {}

  async getGlobalHealth(projectId?: string): Promise<GlobalHealth> {
    const services = await this.dbService.getServices(projectId);
    const incidents = await this.dbService.getIncidents(projectId);
    const scores = await this.dbService.getReliabilityScores(projectId);
    const predictions = await this.dbService.getPredictions(projectId);

    const healthyServicesCount = services.filter(s => s.status === 'healthy').length;
    const degradedServicesCount = services.filter(s => s.status === 'degraded').length;
    const criticalServicesCount = services.filter(s => s.status === 'critical').length;

    const activeIncidents = incidents.filter(i => i.status !== 'resolved');
    const activeIncidentsCount = activeIncidents.length;
    const unresolvedIncidentsCount = activeIncidents.filter(i => i.status === 'open' || i.status === 'investigating').length;

    // Overall reliability score = average of active scores
    let overallReliabilityScore = 100;
    if (scores.length > 0) {
      const sum = scores.reduce((acc, curr) => acc + curr.score, 0);
      overallReliabilityScore = Math.round(sum / scores.length);
    }

    // Overall risk score based on active prediction risks
    let overallRiskScore = 0;
    if (predictions.length > 0) {
      const maxRisk = Math.max(...predictions.map(p => p.riskScore));
      overallRiskScore = maxRisk;
    } else if (activeIncidentsCount > 0) {
      overallRiskScore = Math.min(99, activeIncidentsCount * 25);
    }

    return {
      healthyServicesCount,
      degradedServicesCount,
      criticalServicesCount,
      activeIncidentsCount,
      unresolvedIncidentsCount,
      overallReliabilityScore,
      overallRiskScore,
      timestamp: Date.now()
    };
  }
}
