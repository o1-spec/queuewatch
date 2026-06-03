import { Module, forwardRef } from '@nestjs/common';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { AiModule } from '../ai/ai.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    WebSocketModule,
    forwardRef(() => AiModule),
  ],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
