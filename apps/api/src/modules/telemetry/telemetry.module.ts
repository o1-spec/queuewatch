import { Module, Global, forwardRef } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { WebSocketModule } from '../websocket/websocket.module';
import { IngestController } from './ingest.controller';
import { LogsController } from './logs.controller';
import { MetricsModule } from '../metrics/metrics.module';
import { AuthModule } from '../auth/auth.module';

@Global()
@Module({
  imports: [
    WebSocketModule,
    forwardRef(() => MetricsModule),
    AuthModule,
  ],
  controllers: [IngestController, LogsController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
