import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { QueuesModule } from '../queues/queues.module';
import { MetricsModule } from '../metrics/metrics.module';
import { AuthModule } from '../auth/auth.module';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => QueuesModule),
    forwardRef(() => MetricsModule),
    AuthModule,
    TelemetryModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}

