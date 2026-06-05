import { Module, forwardRef } from '@nestjs/common';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
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
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
