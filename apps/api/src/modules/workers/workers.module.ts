import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkersService } from './workers.service';
import { QueuesModule } from '../queues/queues.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { MetricsModule } from '../metrics/metrics.module';


@Module({
  imports: [
    ConfigModule,
    forwardRef(() => QueuesModule),
    WebSocketModule,
    forwardRef(() => MetricsModule),
  ],
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}
