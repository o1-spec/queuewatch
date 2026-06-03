import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { ServiceRegistryService } from './service-registry.service';
import { ServiceRegistryController } from './service-registry.controller';
import { DependencyGraphService } from '../dependency-graph/dependency-graph.service';
import { ReliabilityScoreService } from '../reliability/reliability-score.service';
import { PredictionService } from '../prediction/prediction.service';
import { ServiceCorrelationService } from '../correlation/service-correlation.service';
import { HealthCenterService } from '../health/health-center.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Module({
  imports: [DbModule],
  controllers: [ServiceRegistryController],
  providers: [
    ServiceRegistryService,
    DependencyGraphService,
    ReliabilityScoreService,
    PredictionService,
    ServiceCorrelationService,
    HealthCenterService,
    AnalyticsService
  ],
  exports: [
    ServiceRegistryService,
    DependencyGraphService,
    ReliabilityScoreService,
    PredictionService,
    ServiceCorrelationService,
    HealthCenterService,
    AnalyticsService
  ]
})
export class ServiceRegistryModule {}
