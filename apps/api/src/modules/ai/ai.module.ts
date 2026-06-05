import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { QueuesModule } from '../queues/queues.module';
import { MetricsModule } from '../metrics/metrics.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => QueuesModule),
    forwardRef(() => MetricsModule),
    AuthModule,
  ],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}

