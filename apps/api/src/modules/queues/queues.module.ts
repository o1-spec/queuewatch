import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueuesService } from './queues.service';
import { QueuesController } from './queues.controller';
import { SimulationController } from './simulation.controller';
import { DeadLetterController } from './dead-letter.controller';
import { SimulationConfigService } from './simulation-config.service';
import { TrafficGeneratorService } from './traffic-generator.service';
import { WebSocketModule } from '../websocket/websocket.module';
import { AuthModule } from '../auth/auth.module';
import { TelemetryModule } from '../telemetry/telemetry.module';

@Module({
  imports: [ConfigModule, WebSocketModule, AuthModule, TelemetryModule],
  controllers: [QueuesController, SimulationController, DeadLetterController],
  providers: [QueuesService, SimulationConfigService, TrafficGeneratorService],
  exports: [QueuesService, SimulationConfigService, TrafficGeneratorService],
})
export class QueuesModule {}



