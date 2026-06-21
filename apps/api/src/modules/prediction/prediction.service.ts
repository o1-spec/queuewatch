import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { Prediction, ReliabilityForecast, ForecastTimeframe } from '@queuewatch/shared';

@Injectable()
export class PredictionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PredictionService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly dbService: DbService) {}

  onModuleInit() {
    // Run continuous analysis loop every 5 minutes
    this.timer = setInterval(() => this.runContinuousAnalysisForAllProjects(), 5 * 60 * 1000);
    this.logger.log('SRE Continuous Reliability Monitoring Agent started on a 5-minute interval.');

    // Trigger initial run after 2 seconds bootstrap delay
    setTimeout(() => {
      this.runContinuousAnalysisForAllProjects().catch(err => {
        this.logger.error('Failed initial predictive analysis run:', err);
      });
    }, 2000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runContinuousAnalysisForAllProjects(): Promise<void> {
    try {
      const projects = await this.dbService.getAllProjects();
      const pids = projects.map(p => p.id);
      if (!pids.includes('proj_demo')) pids.push('proj_demo');

      for (const pid of pids) {
        await this.runContinuousAnalysis(pid);
      }
    } catch (e) {
      this.logger.error('Failed periodic continuous reliability monitoring run:', e);
    }
  }

  async runContinuousAnalysis(projectId?: string): Promise<void> {
    const pid = projectId || 'proj_demo';
    this.logger.log(`[Continuous Agent] Running proactive risk diagnostics for project: ${pid}`);

    try {
      // Clear old entries to keep active alerts fresh and avoid stale noise
      await this.dbService.deletePredictions(pid);
      await this.dbService.deleteForecasts(pid);

      const telemetry = await this.dbService.getTelemetry(200, pid);
      const workers = await this.dbService.getWorkers(pid);
      const incidents = await this.dbService.getIncidents(pid);
      const deployments = await this.dbService.getDeploymentEvents(pid);
      const graph = await this.dbService.getDependencyGraph(pid);
      const reliabilityScores = await this.dbService.getReliabilityScores(pid);
      const services = await this.dbService.getServices(pid);
      const deadLetterJobs = await this.dbService.getDeadLetterJobs(pid);

      let queueNames = await this.dbService.getProjectQueues(pid);
      if (queueNames.length === 0 && pid === 'proj_demo') {
        queueNames = ['email_notifications', 'webhook_delivery', 'image_processing', 'ai_tasks'];
      }

      // BFS Downstream dependents count helper to map blast radius paths
      const getDownstreamNodes = (startNode: string): string[] => {
        const q = [startNode];
        const visited = new Set<string>();
        const result: string[] = [];

        while (q.length > 0) {
          const curr = q.shift()!;
          if (visited.has(curr)) continue;
          visited.add(curr);

          if (curr !== startNode) {
            const label = graph.nodes.find(n => n.id === curr)?.label || curr;
            result.push(label);
          }

          const nextNodes = graph.edges.filter(e => e.from === curr).map(e => e.to);
          for (const n of nextNodes) {
            if (!visited.has(n)) q.push(n);
          }
        }
        return result;
      };

      for (const queue of queueNames) {
        const queueTelemetry = telemetry.filter(t => t.queueName === queue);
        const queueWorkers = workers.filter(w => w.queueName === queue);
        const queueIncidents = incidents.filter(i => i.affectedQueue === queue && i.status !== 'resolved');
        const queueScoreObj = reliabilityScores.find(s => s.targetId === queue && s.targetType === 'queue');
        const currentScore = queueScoreObj ? queueScoreObj.score : 95;

        // Associated service lookup
        const associatedService = services.find(s => s.queues && s.queues.includes(queue));
        const targetService = associatedService ? associatedService.id : `svc_${queue}`;

        const isWorkerSaturated = queueWorkers.some(w => w.status === 'overloaded' || w.status === 'down') ||
          (queueTelemetry.filter(t => t.type === 'job.created').length - queueTelemetry.filter(t => t.type === 'job.completed').length > 5);

        const recentDeployment = deployments.find(d => 
          (d.service === queue || d.service === associatedService?.name || d.service === associatedService?.id) &&
          (Date.now() - d.deployedAt <= 60 * 60 * 1000) // Within 60 minutes
        );
        
        const latencies = queueTelemetry.filter(t => typeof t.duration === 'number' || typeof t.latency === 'number').map(t => (t.duration ?? t.latency) as number);
        const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
        const isLatencyIncreasing = recentDeployment && (avgLatency > 1500 || currentScore < 90);

        const isDLQGrowing = deadLetterJobs.some(j => j.queueName === queue) || 
          queueTelemetry.some(t => t.type === 'job.deadlettered' || t.type === 'job.failed');

        const activeRisks: string[] = [];

        // 1. Worker Saturation Risk Detection
        if (isWorkerSaturated) {
          activeRisks.push('worker_saturation');
          const pred: Prediction = {
            id: `pred_worker_saturation_${queue}`,
            title: `Worker Saturation Risk on ${queue}`,
            riskScore: 85,
            confidenceScore: 88,
            estimatedImpact: `Worker thread pool is saturated. Message processing queue backlog will grow steadily, increasing ingestion latency.`,
            recommendedActions: [
              `Scale up worker replicas to handle the current backlog throughput`,
              `Profile event loop delays and check for memory leaks in worker script`,
              `Optimize job handler execution contexts and database connection limits`
            ],
            reason: `Worker utilization increasing steadily.`,
            targetQueue: queue,
            targetService,
            timestamp: Date.now()
          };
          await this.dbService.savePrediction(pred, pid);
        }

        // 2. Deployment Risk Detection
        if (isLatencyIncreasing && recentDeployment) {
          activeRisks.push('deployment_risk');
          const pred: Prediction = {
            id: `pred_deployment_risk_${queue}`,
            title: `Deployment Regression Risk on ${queue}`,
            riskScore: 75,
            confidenceScore: 92,
            estimatedImpact: `SLA breach impending. Ingestion latency and failures have spiked since version release ${recentDeployment.version}.`,
            recommendedActions: [
              `Initiate automatic canary rollback of service ${recentDeployment.service} to previous version`,
              `Compare commit difference in release ${recentDeployment.version} (${recentDeployment.commitSha.substring(0, 8)})`,
              `Verify environment variables and datastore connectivity overrides`
            ],
            reason: `Recent deployment correlates with increasing latency.`,
            targetQueue: queue,
            targetService: recentDeployment.service,
            timestamp: Date.now()
          };
          await this.dbService.savePrediction(pred, pid);
        }

        // 3. DLQ Growth Risk Detection
        if (isDLQGrowing) {
          activeRisks.push('dlq_growth');
          const pred: Prediction = {
            id: `pred_dlq_growth_${queue}`,
            title: `Dead-Letter Queue (DLQ) Growth Risk on ${queue}`,
            riskScore: 90,
            confidenceScore: 95,
            estimatedImpact: `Poison pill payloads are accumulating. Affected customer transactions are failing and will require manual replaying.`,
            recommendedActions: [
              `Acknowledge and inspect poison pill payload formats in dead-letter center`,
              `Apply validation overrides or catch blocks to worker processing handlers`,
              `Replay or discard failed dead-lettered jobs in queue console`
            ],
            reason: `Dead-letter jobs increasing for 20 minutes.`,
            targetQueue: queue,
            targetService,
            timestamp: Date.now()
          };
          await this.dbService.savePrediction(pred, pid);
        }

        // 4. Reliability Forecasting calculations
        const forecasts: ForecastTimeframe[] = [];
        const timeframes: ('1h' | '6h' | '24h')[] = ['1h', '6h', '24h'];

        // Base risk parameters
        let baseProb = 5;
        let scoreDegradationStep = 0;

        if (activeRisks.includes('worker_saturation')) {
          baseProb += 30;
          scoreDegradationStep += 4;
        }
        if (activeRisks.includes('deployment_risk')) {
          baseProb += 45;
          scoreDegradationStep += 6;
        }
        if (activeRisks.includes('dlq_growth')) {
          baseProb += 40;
          scoreDegradationStep += 5;
        }

        // Adjust probability based on active incidents
        if (queueIncidents.length > 0) {
          baseProb = 100;
        }

        const downstreamNodes = getDownstreamNodes(queue);

        for (const tf of timeframes) {
          let probability = baseProb;
          let multiplier = 1.0;
          let degradationMultiplier = 1.0;

          if (tf === '6h') {
            multiplier = 1.25;
            degradationMultiplier = 2.5;
          } else if (tf === '24h') {
            multiplier = 1.5;
            degradationMultiplier = 4.5;
          }

          probability = Math.round(probability * multiplier);
          if (queueIncidents.length > 0) {
            probability = 100;
          } else {
            probability = Math.min(99, probability);
          }

          const projectedScores: number[] = [];
          for (let i = 1; i <= 3; i++) {
            const stepDegradation = scoreDegradationStep * degradationMultiplier * (i / 3);
            projectedScores.push(Math.max(10, Math.round(currentScore - stepDegradation)));
          }

          forecasts.push({
            timeframe: tf,
            incidentProbability: probability,
            reliabilityScoreTrajectory: projectedScores,
            blastRadiusPotential: probability > 15 ? downstreamNodes : []
          });
        }

        const forecast: ReliabilityForecast = {
          targetId: queue,
          targetType: 'queue',
          forecasts,
          timestamp: Date.now()
        };

        await this.dbService.saveForecast(forecast, pid);
      }
    } catch (e) {
      this.logger.error(`Failed to process proactive analysis for ${pid}:`, e);
    }
  }

  async getLatestPredictions(projectId?: string): Promise<Prediction[]> {
    const list = await this.dbService.getPredictions(projectId);
    if (list.length === 0) {
      await this.runContinuousAnalysis(projectId);
      return this.dbService.getPredictions(projectId);
    }
    return list;
  }

  async getReliabilityForecasts(projectId?: string): Promise<ReliabilityForecast[]> {
    const list = await this.dbService.getForecasts(projectId);
    if (list.length === 0) {
      await this.runContinuousAnalysis(projectId);
      return this.dbService.getForecasts(projectId);
    }
    return list;
  }

  async getPredictionById(id: string, projectId?: string): Promise<Prediction | null> {
    return this.dbService.getPrediction(id, projectId);
  }
}
