import { Injectable, Logger } from '@nestjs/common';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';
import { QueueName, JobStatus, TelemetryEvent } from '@queuewatch/shared';
import { DbService } from '../db/db.service';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    private wsGateway: QueueWebSocketGateway,
    private dbService: DbService
  ) {}

  async recordEvent(event: Omit<TelemetryEvent, 'id' | 'timestamp'>) {
    const fullEvent: TelemetryEvent = {
      ...event,
      id: (event as any).id || `tel_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    } as TelemetryEvent;

    // Save to Redis Persistent database
    await this.dbService.saveTelemetry(fullEvent);

    // Broadcast telemetry via WS gateway
    this.wsGateway.broadcast('telemetry.event', fullEvent);
    this.logger.debug(`[Telemetry] Persisted ${fullEvent.type} on ${fullEvent.queueName}`);
  }

  async getEvents(limit = 100): Promise<TelemetryEvent[]> {
    return this.dbService.getTelemetry(limit);
  }

  async getQueueEvents(queueName: QueueName, limit = 50): Promise<TelemetryEvent[]> {
    return this.dbService.getTelemetryByQueue(queueName, limit);
  }
}
