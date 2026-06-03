import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { DbModule } from '../db/db.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [ConfigModule, DbModule, WebSocketModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
