import { Module, forwardRef } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { QueuesModule } from '../queues/queues.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    forwardRef(() => QueuesModule),
    WebSocketModule,
    forwardRef(() => IncidentsModule),
    AlertsModule,
  ],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}

