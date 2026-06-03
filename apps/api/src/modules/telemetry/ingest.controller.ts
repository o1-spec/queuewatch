import { Controller, Post, Body, Headers, UnauthorizedException, Logger, Inject, forwardRef } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DbService } from '../db/db.service';
import { TelemetryService } from './telemetry.service';
import { MetricsService } from '../metrics/metrics.service';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';
import { QueueName } from '@queuewatch/shared';

@ApiTags('SDK Telemetry Ingestion')
@Controller('ingest')
export class IngestController {
  private readonly logger = new Logger(IngestController.name);

  constructor(
    private readonly dbService: DbService,
    private readonly telemetryService: TelemetryService,
    @Inject(forwardRef(() => MetricsService))
    private readonly metricsService: MetricsService,
    private readonly wsGateway: QueueWebSocketGateway
  ) {}

  private async authorize(authHeader: string): Promise<string> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    const token = authHeader.substring(7);
    const owner = await this.dbService.validateApiKey(token);
    if (!owner) {
      throw new UnauthorizedException('Invalid API Key credentials');
    }
    return owner;
  }

  @Post('events')
  @ApiOperation({ summary: 'Ingest batched events from SDK' })
  async ingestEvents(
    @Headers('authorization') authHeader: string,
    @Body() body: { events: any[] }
  ) {
    await this.authorize(authHeader);
    
    const events = body.events || [];
    this.logger.log(`Ingesting ${events.length} telemetry events from SDK`);

    for (const event of events) {
      // Save to database
      const telemetryEvent = {
        ...event,
        id: event.id || `tel_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: event.timestamp || Date.now(),
      };
      await this.dbService.saveTelemetry(telemetryEvent);

      // Record latency snapshot if completed
      if (event.type === 'job.completed' && typeof event.duration === 'number') {
        this.metricsService.recordLatency(event.queueName, event.duration);
      }

      // Broadcast event via WebSockets
      this.wsGateway.broadcast('telemetry.event', telemetryEvent);
    }

    return { success: true, count: events.length };
  }

  @Post('logs')
  @ApiOperation({ summary: 'Ingest log statements from SDK' })
  async ingestLogs(
    @Headers('authorization') authHeader: string,
    @Body() body: any
  ) {
    await this.authorize(authHeader);

    const logEntry = {
      ...body,
      id: body.id || `log_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: body.timestamp || Date.now(),
    };

    await this.dbService.saveLog(logEntry);
    this.wsGateway.broadcast('log.ingested', logEntry);

    return { success: true };
  }

  @Post('heartbeat')
  @ApiOperation({ summary: 'Ingest worker heartbeat telemetry from SDK' })
  async ingestHeartbeat(
    @Headers('authorization') authHeader: string,
    @Body() body: any
  ) {
    await this.authorize(authHeader);

    const report = {
      workerId: body.workerId || 'sdk_worker',
      queueName: body.queueName,
      status: body.status || 'healthy',
      concurrency: body.concurrency || 5,
      cpuUsage: body.cpuUsage || 10,
      memoryUsage: body.memoryUsage || 15,
      lastActive: Date.now(),
    };

    this.wsGateway.broadcast('worker.health.updated', [report]);
    return { success: true };
  }
}
