import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly dbService: DbService) {}

  async getReports(): Promise<{
    incidentsBySeverity: Record<string, number>;
    mttrMinutes: number;
    topRecurringIssues: { pattern: string; count: number }[];
    deploymentStabilityRate: number;
    queuePerformance: { name: string; throughput: number; failureRate: number }[];
    serviceReliability: { name: string; score: number }[];
  }> {
    const incidents = await this.dbService.getIncidents();
    const scores = await this.dbService.getReliabilityScores();
    const services = await this.dbService.getServices();

    // 1. Incidents by severity
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const inc of incidents) {
      const sev = inc.severity || 'low';
      if (sev === 'critical') severityCounts.critical++;
      else if (sev === 'high') severityCounts.high++;
      else if (sev === 'medium') severityCounts.medium++;
      else severityCounts.low++;
    }

    // 2. Average MTTR calculation (mocked/simulated based on resolved incidents)
    const resolved = incidents.filter(i => i.status === 'resolved');
    let mttrSum = 0;
    for (const r of resolved) {
      if (r.resolvedAt && r.firstDetectedAt) {
        mttrSum += Math.max(1, Math.round((r.resolvedAt - r.firstDetectedAt) / 60000));
      }
    }
    const mttrMinutes = resolved.length > 0 ? Math.round(mttrSum / resolved.length) : 18;

    // 3. Top recurring issues
    const recurringMap = new Map<string, number>();
    for (const inc of incidents) {
      const signature = inc.suspectedRootCause || 'Uncategorized exceptions';
      recurringMap.set(signature, (recurringMap.get(signature) || 0) + 1);
    }
    const topRecurringIssues = Array.from(recurringMap.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // 4. Deployment stability rate
    const deployments = await this.dbService.getDeploymentEvents();
    // Stability rate = 100% minus percent of deployments correlated to incidents
    let incidentCorrelatedCount = 0;
    for (const dep of deployments) {
      const matches = incidents.filter(i => {
        const delay = i.firstDetectedAt - dep.deployedAt;
        return delay >= 0 && delay <= 30 * 60 * 1000;
      });
      if (matches.length > 0) {
        incidentCorrelatedCount++;
      }
    }
    const totalDeps = deployments.length || 1;
    const deploymentStabilityRate = Math.round(((totalDeps - incidentCorrelatedCount) / totalDeps) * 100);

    // 5. Queue performance
    const queuePerformance = scores
      .filter(s => s.targetType === 'queue')
      .map(s => ({
        name: s.targetId,
        throughput: 120, // jobs/min simulated
        failureRate: s.failureRate
      }));

    // 6. Service reliability scores
    const serviceReliability = scores
      .filter(s => s.targetType === 'service')
      .map(s => {
        const svc = services.find(sv => sv.id === s.targetId);
        return {
          name: svc ? svc.name : s.targetId,
          score: s.score
        };
      });

    return {
      incidentsBySeverity: severityCounts,
      mttrMinutes,
      topRecurringIssues,
      deploymentStabilityRate,
      queuePerformance,
      serviceReliability
    };
  }
}
