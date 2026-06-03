import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
  async getServices() {
    return this.serviceRegistry.getServices();
  }

  @Get('services/environments')
  @ApiOperation({ summary: 'Get all environments' })
  async getEnvironments() {
    return this.serviceRegistry.getEnvironments();
  }

  @Post('services')
  @ApiOperation({ summary: 'Create new service' })
  async createService(@Body() service: Service) {
    return this.serviceRegistry.createService(service);
  }

  // --- Dependencies ---
  @Get('dependencies/graph')
  @ApiOperation({ summary: 'Get global dependency graph' })
  async getGraph() {
    return this.depGraph.getGraph();
  }

  @Get('dependencies/:serviceId')
  @ApiParam({ name: 'serviceId' })
  async getServiceDependencies(@Param('serviceId') serviceId: string) {
    return this.depGraph.getDependencies(serviceId);
  }

  // --- Reliability Scores ---
  @Get('reliability')
  @ApiOperation({ summary: 'Get current reliability scores' })
  async getReliability() {
    return this.reliabilityScore.getLatestScores();
  }

  @Get('reliability/history/:targetId')
  @ApiParam({ name: 'targetId' })
  async getHistory(@Param('targetId') targetId: string) {
    return this.reliabilityScore.getHistory(targetId);
  }

  // --- Predictions ---
  @Get('predictions')
  @ApiOperation({ summary: 'Get active predictions and risk scores' })
  async getPredictions() {
    return this.prediction.getLatestPredictions();
  }

  @Get('predictions/:id')
  @ApiParam({ name: 'id' })
  async getPrediction(@Param('id') id: string) {
    return this.prediction.getPredictionById(id);
  }

  // --- Global Health Center ---
  @Get('health-center')
  @ApiOperation({ summary: 'Get SRE Operational Health Center summaries' })
  async getHealth() {
    return this.healthCenter.getGlobalHealth();
  }

  // --- Analytics ---
  @Get('analytics')
  @ApiOperation({ summary: 'Get SRE Reports and MTTR analytics' })
  async getAnalytics() {
    return this.analytics.getReports();
  }

  // --- Incident Blast Radius ---
  @Get('incidents/:id/blast-radius')
  @ApiParam({ name: 'id' })
  async getBlastRadius(@Param('id') id: string) {
    return this.correlation.calculateBlastRadius(id);
  }
}
