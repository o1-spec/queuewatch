import { Module, forwardRef } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { QueuesModule } from '../queues/queues.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    forwardRef(() => QueuesModule),
    WebSocketModule,
  ],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
