import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HealthModule } from './modules/health/health.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { QueuesModule } from './modules/queues/queues.module';
import { WorkersModule } from './modules/workers/workers.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { TelemetryModule } from './modules/telemetry/telemetry.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { DbModule } from './modules/db/db.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AgentModule } from './modules/agent/agent.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DeploymentsModule } from './modules/deployments/deployments.module';
import { EscalationModule } from './modules/escalation/escalation.module';
import { CopilotModule } from './modules/copilot/copilot.module';
import { ServiceRegistryModule } from './modules/service-registry/service-registry.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { TelemetryGateInterceptor } from './modules/auth/telemetry-gate.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env', // Load monorepo root env file
    }),
    DbModule,
    HealthModule,
    WebSocketModule,
    QueuesModule,
    WorkersModule,
    MetricsModule,
    AiModule,
    AuthModule,
    TelemetryModule,
    IncidentsModule,
    AlertsModule,
    AgentModule,
    NotificationsModule,
    DeploymentsModule,
    EscalationModule,
    CopilotModule,
    ServiceRegistryModule,
    ProjectsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TelemetryGateInterceptor,
    },
  ],
})
export class AppModule {}


