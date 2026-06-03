import { Module, forwardRef } from '@nestjs/common';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { AiModule } from '../ai/ai.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DbModule } from '../db/db.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { GitHubService } from '../integrations/github.service';
import { JiraService } from '../integrations/jira.service';

@Module({
  imports: [
    WebSocketModule,
    forwardRef(() => AiModule),
    NotificationsModule,
    DbModule,
    TelemetryModule,
  ],
  controllers: [IncidentsController],
  providers: [IncidentsService, GitHubService, JiraService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
