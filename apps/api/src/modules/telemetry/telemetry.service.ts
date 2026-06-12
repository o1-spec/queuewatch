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

  async recordEvent(event: Omit<TelemetryEvent, 'id' | 'timestamp'>, projectId?: string) {
    const fullEvent: TelemetryEvent = {
      ...event,
      id: (event as any).id || `tel_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    } as TelemetryEvent;

    // Save to Redis Persistent database
    await this.dbService.saveTelemetry(fullEvent, projectId);

    // Broadcast telemetry via WS gateway with projectId attached
    this.wsGateway.broadcast('telemetry.event', { ...fullEvent, projectId });
    if (fullEvent.type !== 'worker.status') {
      this.logger.debug(`[Telemetry] Persisted ${fullEvent.type} on ${fullEvent.queueName} for project ${projectId || 'proj_demo'}`);
    }
  }

  async getEvents(limit = 100, projectId?: string): Promise<TelemetryEvent[]> {
    return this.dbService.getTelemetry(limit, projectId);
  }

  async getQueueEvents(queueName: QueueName, limit = 50, projectId?: string): Promise<TelemetryEvent[]> {
    return this.dbService.getTelemetryByQueue(queueName, limit, projectId);
  }
}
