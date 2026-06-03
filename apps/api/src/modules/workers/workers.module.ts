import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorkersService } from './workers.service';
import { WorkersController } from './workers.controller';
import { QueuesModule } from '../queues/queues.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { MetricsModule } from '../metrics/metrics.module';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => QueuesModule),
    WebSocketModule,
    forwardRef(() => MetricsModule),
    TelemetryModule,
    AuthModule,
  ],
  controllers: [WorkersController],
  providers: [WorkersService],
  exports: [WorkersService],
})
export class WorkersModule {}


