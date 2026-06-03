import { Module } from '@nestjs/common';
import { DeploymentsController } from './deployments.controller';
import { DbModule } from '../db/db.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [DbModule, WebSocketModule],
  controllers: [DeploymentsController],
  exports: [],
})
export class DeploymentsModule {}
