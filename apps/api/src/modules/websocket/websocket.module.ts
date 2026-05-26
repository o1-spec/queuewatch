import { Module } from '@nestjs/common';
import { QueueWebSocketGateway } from './websocket.gateway';

@Module({
  providers: [QueueWebSocketGateway],
  exports: [QueueWebSocketGateway],
})
export class WebSocketModule {}
