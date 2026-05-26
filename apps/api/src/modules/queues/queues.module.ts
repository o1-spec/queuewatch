import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueuesService } from './queues.service';
import { QueuesController } from './queues.controller';
import { SimulationConfigService } from './simulation-config.service';
import { TrafficGeneratorService } from './traffic-generator.service';
import { WebSocketModule } from '../websocket/websocket.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, WebSocketModule, AuthModule],
  controllers: [QueuesController],
  providers: [QueuesService, SimulationConfigService, TrafficGeneratorService],
  exports: [QueuesService, SimulationConfigService, TrafficGeneratorService],
})
export class QueuesModule {}
