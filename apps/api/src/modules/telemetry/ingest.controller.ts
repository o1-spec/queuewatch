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

  private async authorize(authHeader: string, payloadProjectId?: string): Promise<{ projectId: string; userId: string }> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    if (!payloadProjectId) {
      throw new UnauthorizedException('Missing projectId in telemetry payload');
    }
    const token = authHeader.substring(7);
    const mapping = await this.dbService.resolveApiKey(token);
    if (!mapping) {
      throw new UnauthorizedException('Invalid API Key credentials');
    }
    if (mapping.projectId !== payloadProjectId) {
      throw new UnauthorizedException('API Key does not match the provided Project ID');
    }
    return mapping;
  }

  @Post('events')
  @ApiOperation({ summary: 'Ingest batched events from SDK' })
  async ingestEvents(
    @Headers('authorization') authHeader: string,
    @Body() body: { events: any[]; projectId?: string }
  ) {
    const projectId = body.projectId || (body.events && body.events[0]?.projectId);
    const { userId } = await this.authorize(authHeader, projectId);
    
    const events = body.events || [];
    this.logger.log(`Ingesting ${events.length} telemetry events from SDK for project ${projectId}`);

    // Mark project as telemetry received
    await this.dbService.markProjectTelemetryReceived(projectId);

    for (const event of events) {
      // Register queue name dynamically
      if (event.queueName) {
        await this.dbService.registerProjectQueue(projectId, event.queueName);
      }

      // Save to database
      const telemetryEvent = {
        ...event,
        id: event.id || `tel_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: event.timestamp || Date.now(),
      };
      await this.dbService.saveTelemetry(telemetryEvent, projectId);

      // Record latency snapshot if completed
      if (event.type === 'job.completed' && typeof event.duration === 'number') {
        this.metricsService.recordLatency(event.queueName, event.duration);
      }

      // Broadcast event via WebSockets with projectId attached
      this.wsGateway.broadcast('telemetry.event', { ...telemetryEvent, projectId });
    }

    return { success: true, count: events.length };
  }

  @Post('logs')
  @ApiOperation({ summary: 'Ingest log statements from SDK' })
  async ingestLogs(
    @Headers('authorization') authHeader: string,
    @Body() body: any
  ) {
    const projectId = body.projectId;
    await this.authorize(authHeader, projectId);

    // Mark project as telemetry received
    await this.dbService.markProjectTelemetryReceived(projectId);

    // Register queue name if present in metadata
    if (body.queueName) {
      await this.dbService.registerProjectQueue(projectId, body.queueName);
    }

    const logEntry = {
      ...body,
      id: body.id || `log_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: body.timestamp || Date.now(),
    };

    await this.dbService.saveLog(logEntry, projectId);
    this.wsGateway.broadcast('log.ingested', { ...logEntry, projectId });

    return { success: true };
  }

  @Post('heartbeat')
  @ApiOperation({ summary: 'Ingest worker heartbeat telemetry from SDK' })
  async ingestHeartbeat(
    @Headers('authorization') authHeader: string,
    @Body() body: any
  ) {
    const projectId = body.projectId;
    await this.authorize(authHeader, projectId);

    // Mark project as telemetry received
    await this.dbService.markProjectTelemetryReceived(projectId);

    // Register queue name if present
    if (body.queueName) {
      await this.dbService.registerProjectQueue(projectId, body.queueName);
    }

    const report = {
      workerId: body.workerId || 'sdk_worker',
      queueName: body.queueName,
      status: body.status || 'healthy',
      concurrency: body.concurrency || 5,
      cpuUsage: body.cpuUsage || 10,
      memoryUsage: body.memoryUsage || 15,
      lastActive: Date.now(),
    };

    // Save worker health report to DB
    await this.dbService.saveWorker(report, projectId);

    this.wsGateway.broadcast('worker.health.updated', [{ ...report, projectId }]);
    return { success: true };
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify API Key and Project connectivity' })
  async verifyConnection(
    @Headers('authorization') authHeader: string,
    @Body() body: { projectId: string }
  ) {
    const { projectId } = await this.authorize(authHeader, body.projectId);
    const project = await this.dbService.getProject(projectId);
    return {
      success: true,
      projectName: project ? project.name : 'Unknown Project',
    };
  }
}
