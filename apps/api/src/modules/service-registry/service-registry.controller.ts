import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectId } from '../auth/project-id.decorator';
import { ServiceRegistryService } from './service-registry.service';
import { DependencyGraphService } from '../dependency-graph/dependency-graph.service';
import { ReliabilityScoreService } from '../reliability/reliability-score.service';
import { PredictionService } from '../prediction/prediction.service';
import { ServiceCorrelationService } from '../correlation/service-correlation.service';
import { HealthCenterService } from '../health/health-center.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { Service } from '@queuewatch/shared';

@ApiTags('SRE Intelligence & Service Registry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class ServiceRegistryController {
  constructor(
    private readonly serviceRegistry: ServiceRegistryService,
    private readonly depGraph: DependencyGraphService,
    private readonly reliabilityScore: ReliabilityScoreService,
    private readonly prediction: PredictionService,
    private readonly correlation: ServiceCorrelationService,
    private readonly healthCenter: HealthCenterService,
    private readonly analytics: AnalyticsService
  ) {}

  // --- Services ---
  @Get('services')
  @ApiOperation({ summary: 'Get all registered services' })
  async getServices(@ProjectId() projectId: string) {
    return this.serviceRegistry.getServices(projectId);
  }

  @Get('services/environments')
  @ApiOperation({ summary: 'Get all environments' })
  async getEnvironments(@ProjectId() projectId: string) {
    return this.serviceRegistry.getEnvironments(projectId);
  }

  @Post('services')
  @ApiOperation({ summary: 'Create new service' })
  async createService(@ProjectId() projectId: string, @Body() service: Service) {
    return this.serviceRegistry.createService(service, projectId);
  }

  // --- Dependencies ---
  @Get('dependencies/graph')
  @ApiOperation({ summary: 'Get global dependency graph' })
  async getGraph(@ProjectId() projectId: string) {
    return this.depGraph.getGraph(projectId);
  }

  @Get('dependencies/:serviceId')
  @ApiParam({ name: 'serviceId' })
  async getServiceDependencies(@ProjectId() projectId: string, @Param('serviceId') serviceId: string) {
    return this.depGraph.getDependencies(serviceId, projectId);
  }

  // --- Reliability Scores ---
  @Get('reliability')
  @ApiOperation({ summary: 'Get current reliability scores' })
  async getReliability(@ProjectId() projectId: string) {
    return this.reliabilityScore.getLatestScores(projectId);
  }

  @Get('reliability/history/:targetId')
  @ApiParam({ name: 'targetId' })
  async getHistory(@ProjectId() projectId: string, @Param('targetId') targetId: string) {
    return this.reliabilityScore.getHistory(targetId, projectId);
  }

  // --- Predictions ---
  @Get('predictions')
  @ApiOperation({ summary: 'Get active predictions and risk scores' })
  async getPredictions(@ProjectId() projectId: string) {
    return this.prediction.getLatestPredictions(projectId);
  }

  @Post('predictions/analyze')
  @ApiOperation({ summary: 'Trigger manual continuous reliability analysis run' })
  async runAnalysis(@ProjectId() projectId: string) {
    await this.prediction.runContinuousAnalysis(projectId);
    return { success: true, message: 'Continuous reliability analysis completed.' };
  }

  @Get('predictions/forecast')
  @ApiOperation({ summary: 'Get active reliability forecasts and trajectories' })
  async getForecast(@ProjectId() projectId: string) {
    return this.prediction.getReliabilityForecasts(projectId);
  }

  @Get('predictions/:id')
  @ApiParam({ name: 'id' })
  async getPrediction(@ProjectId() projectId: string, @Param('id') id: string) {
    return this.prediction.getPredictionById(id, projectId);
  }

  // --- Global Health Center ---
  @Get('health-center')
  @ApiOperation({ summary: 'Get SRE Operational Health Center summaries' })
  async getHealth(@ProjectId() projectId: string) {
    return this.healthCenter.getGlobalHealth(projectId);
  }

  // --- Analytics ---
  @Get('analytics')
  @ApiOperation({ summary: 'Get SRE Reports and MTTR analytics' })
  async getAnalytics(@ProjectId() projectId: string) {
    return this.analytics.getReports(projectId);
  }

  // --- Incident Blast Radius ---
  @Get('incidents/:id/blast-radius')
  @ApiParam({ name: 'id' })
  async getBlastRadius(@ProjectId() projectId: string, @Param('id') id: string) {
    return this.correlation.calculateBlastRadius(id, projectId);
  }
}
