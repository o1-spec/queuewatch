import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { QueuesModule } from './modules/queues/queues.module';
import { WorkersModule } from './modules/workers/workers.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env', // Load monorepo root env file
    }),
    HealthModule,
    WebSocketModule,
    QueuesModule,
    WorkersModule,
    MetricsModule,
    AiModule,
    AuthModule,
  ],
})
export class AppModule {}
