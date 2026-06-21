import { Module, forwardRef } from '@nestjs/common';
import { AgentController, IncidentAgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { RemediationService } from './remediation.service';
import { RemediationController } from './remediation.controller';
import { QueuesModule } from '../queues/queues.module';
import { WorkersModule } from '../workers/workers.module';
import { AiModule } from '../ai/ai.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    forwardRef(() => QueuesModule),
    forwardRef(() => WorkersModule),
    AiModule,
    WebSocketModule,
    AuthModule,
  ],
  controllers: [AgentController, IncidentAgentController, RemediationController],
  providers: [AgentService, RemediationService],
  exports: [AgentService, RemediationService],
})
export class AgentModule {}
