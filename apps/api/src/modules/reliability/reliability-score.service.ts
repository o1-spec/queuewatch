import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { ReliabilityScore, QueueMetrics, WorkerHealth, Incident } from '@queuewatch/shared';

@Injectable()
export class ReliabilityScoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReliabilityScoreService.name);
  private timer: NodeJS.Timeout | null = null;

  // SRE Component Weights (Sum = 1.0)
  private readonly weights = {
    failureRate: 0.25,
    latency: 0.20,
    worker: 0.15,
    incident: 0.25,
    blastRadius: 0.10,
    deployment: 0.05,
  };

  // SRE SLO Targets (Latency Target in ms)
  private readonly latencySLOs: Record<string, number> = {
    email_notifications: 1000,
    webhook_delivery: 1500,
    image_processing: 2000,
    ai_tasks: 5000,
  };

  constructor(private readonly dbService: DbService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.recalculateAllProjects(), 30_000);
    this.logger.log('SRE Reliability Scoring aggregation engine started on a 30s interval.');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async recalculateAllProjects() {
    try {
      const projects = await this.dbService.getAllProjects();
      const ids = projects.map(p => p.id);
      if (!ids.includes('proj_demo')) ids.push('proj_demo');

      for (const pid of ids) {
        await this.recalculateAllScores(pid);
      }
    } catch (e) {
      this.logger.error('Failed to run periodic reliability scores updates:', e);
    }
  }

  async getLatestScores(projectId?: string): Promise<ReliabilityScore[]> {
    const scores = await this.dbService.getReliabilityScores(projectId);
    if (scores.length === 0) {
      await this.recalculateAllScores(projectId);
      return this.dbService.getReliabilityScores(projectId);
    }
    return scores;
  }

  async getHistory(targetId: string, projectId?: string): Promise<ReliabilityScore[]> {
    return this.dbService.getReliabilityHistory(targetId, projectId);
  }

  async recalculateAllScores(projectId?: string): Promise<void> {
    try {
      const pid = projectId || 'proj_demo';
      const incidents = await this.dbService.getIncidents(pid);
      const telemetry = await this.dbService.getTelemetry(200, pid);
      const workers = await this.dbService.getWorkers(pid);
      const graph = await this.dbService.getDependencyGraph(pid);
      const deployments = await this.dbService.getDeploymentEvents(pid);
      const services = await this.dbService.getServices(pid);

      let queueNames = await this.dbService.getProjectQueues(pid);
      if (queueNames.length === 0 && (pid === 'proj_demo' || !projectId)) {
        queueNames = ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'];
      }

      // BFS Downstream dependents count helper
      const getDownstreamCount = (startNode: string) => {
        const q = [startNode];
        const vis = new Set<string>();
        while (q.length > 0) {
          const curr = q.shift()!;
          if (vis.has(curr)) continue;
          vis.add(curr);
          const nextNodes = graph.edges.filter(e => e.from === curr).map(e => e.to);
          for (const n of nextNodes) {
            if (!vis.has(n)) q.push(n);
          }
        }
        return Math.max(0, vis.size - 1);
      };

      for (const queue of queueNames) {
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

        // Fetch latency
        const latencies = queueTelemetry.filter(t => typeof t.duration === 'number' || typeof t.latency === 'number').map(t => (t.duration ?? t.latency) as number);
        const averageLatency = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
        const latencyTarget = this.latencySLOs[queue] || 1000;

        // 1. Failure rate deduction
        const deduction_failure = Math.round(failureRate * this.weights.failureRate);

        // 2. Latency deduction
        const latencyRatio = averageLatency > latencyTarget ? Math.min(1.0, (averageLatency - latencyTarget) / latencyTarget) : 0;
        const deduction_latency = Math.round(latencyRatio * 100 * this.weights.latency);

        // 3. Worker deduction
        const deduction_worker = Math.round((100 - workerHealthScore) * this.weights.worker);

        // 4. Incident severity deduction
        let worstSeverityFactor = 0;
        for (const inc of activeIncidents) {
          let severityVal = 0;
          if (inc.severity === 'critical') severityVal = 100;
          else if (inc.severity === 'high') severityVal = 60;
          else if (inc.severity === 'medium') severityVal = 40;
          else if (inc.severity === 'low') severityVal = 15;
          if (severityVal > worstSeverityFactor) worstSeverityFactor = severityVal;
        }
        const deduction_incident = Math.round(worstSeverityFactor * this.weights.incident);

        // 5. Blast radius deduction
        let deduction_blast = 0;
        if (activeIncidents.length > 0) {
          const downstreamCount = getDownstreamCount(queue);
          const blastRatio = Math.min(1.0, downstreamCount / 4);
          deduction_blast = Math.round(blastRatio * 100 * this.weights.blastRadius);
        }

        // 6. Recent regression deployment deduction
        let deduction_deployment = 0;
        if (activeIncidents.length > 0) {
          const linkedServices = services.filter(s => s.queues && s.queues.includes(queue));
          const hasRegression = activeIncidents.some(inc => 
            deployments.some(dep => 
              (linkedServices.some(s => s.name === dep.service || s.id === dep.service) || dep.service === queue) &&
              (inc.firstDetectedAt - dep.deployedAt >= 0) &&
              (inc.firstDetectedAt - dep.deployedAt <= 30 * 60 * 1000)
            )
          );
          if (hasRegression) {
            deduction_deployment = Math.round(100 * this.weights.deployment);
          }
        }

        const score = Math.max(0, 100 - (deduction_failure + deduction_latency + deduction_worker + deduction_incident + deduction_blast + deduction_deployment));

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
          mttrMinutes: 15,
          timestamp: Date.now(),
          contributors: {
            failureRate: -deduction_failure,
            latency: -deduction_latency,
            workerHealth: -deduction_worker,
            incidents: -deduction_incident,
            blastRadius: -deduction_blast,
            deployments: -deduction_deployment
          }
        };

        await this.dbService.saveReliabilityScore(newScore, pid);
      }

      // Compute service level scores
      const allScores = await this.dbService.getReliabilityScores(pid);

      for (const svc of services) {
        let scoreSum = 0;
        let count = 0;

        let failureRateSum = 0;
        let latencySum = 0;
        let workerHealthSum = 0;
        let incidentsSum = 0;
        let blastRadiusSum = 0;
        let deploymentsSum = 0;

        for (const queue of svc.queues) {
          const qScore = allScores.find(s => s.targetId === queue && s.targetType === 'queue');
          if (qScore) {
            scoreSum += qScore.score;
            count++;
            if (qScore.contributors) {
              failureRateSum += qScore.contributors.failureRate;
              latencySum += qScore.contributors.latency;
              workerHealthSum += qScore.contributors.workerHealth;
              incidentsSum += qScore.contributors.incidents;
              blastRadiusSum += qScore.contributors.blastRadius;
              deploymentsSum += qScore.contributors.deployments;
            }
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
          timestamp: Date.now(),
          contributors: count > 0 ? {
            failureRate: Math.round(failureRateSum / count),
            latency: Math.round(latencySum / count),
            workerHealth: Math.round(workerHealthSum / count),
            incidents: Math.round(incidentsSum / count),
            blastRadius: Math.round(blastRadiusSum / count),
            deployments: Math.round(deploymentsSum / count)
          } : {
            failureRate: 0,
            latency: 0,
            workerHealth: svc.status === 'healthy' ? 0 : -10,
            incidents: svc.incidents.length > 0 ? -15 : 0,
            blastRadius: 0,
            deployments: 0
          }
        };

        await this.dbService.saveReliabilityScore(newScore, pid);
      }
    } catch (e) {
      this.logger.error('Failed to recalculate SRE reliability scores:', e);
    }
  }
}
