import { Controller, Post, Body, Headers, UnauthorizedException, Logger, Inject, forwardRef } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DbService } from '../db/db.service';
import { TelemetryService } from './telemetry.service';
import { MetricsService } from '../metrics/metrics.service';
import { QueueWebSocketGateway } from '../websocket/websocket.gateway';
import { QueueName, DeploymentEvent } from '@queuewatch/shared';

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
        await this.dbService.discoverService(projectId, event.serviceName, event.queueName, event.workerId);
      }

      // Save to database
      const traceId = event.traceId || event.payload?.traceId || (event.payload && typeof event.payload === 'object' ? event.payload.traceId : undefined);
      const telemetryEvent = {
        ...event,
        id: event.id || `tel_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: event.timestamp || Date.now(),
        traceId,
      };
      await this.dbService.saveTelemetry(telemetryEvent, projectId);

      // Record latency snapshot if completed
      if (event.type === 'job.completed' && typeof event.duration === 'number') {
        this.metricsService.recordLatency(event.queueName, event.duration);
      }

      // Generate structured SRE logs for anomalies/warnings/failures (skip completed/created/active)
      if (['job.failed', 'job.stalled', 'job.delayed', 'job.deadlettered'].includes(event.type)) {
        const level: 'info' | 'warn' | 'error' = (event.type === 'job.failed' || event.type === 'job.deadlettered') ? 'error' :
                      (event.type === 'job.stalled') ? 'warn' : 'info';
        
        let msg = '';
        if (event.type === 'job.failed') {
          msg = event.errorMessage || 'Job execution failed';
        } else if (event.type === 'job.deadlettered') {
          msg = `Job dead-lettered: ${event.errorMessage || 'Threshold exceeded'}`;
        } else if (event.type === 'job.stalled') {
          msg = `Job stalled during execution`;
        } else if (event.type === 'job.delayed') {
          msg = `Job execution delayed`;
        }

        const logEntry = {
          id: `log_${Math.random().toString(36).substr(2, 9)}`,
          level,
          message: msg,
          queueName: event.queueName,
          serviceName: event.serviceName || 'unknown-service',
          workerName: event.workerId,
          timestamp: Date.now(),
          traceId,
          jobId: event.jobId,
          metadata: event.payload
        };

        await this.dbService.saveLog(logEntry, projectId);
        this.wsGateway.broadcast('log.ingested', { ...logEntry, projectId });
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
      await this.dbService.discoverService(projectId, body.serviceName, body.queueName, body.workerName);
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

    const now = Date.now();
    const report = {
      workerId: body.workerId || 'sdk_worker',
      queueName: body.queueName,
      status: body.status || 'healthy',
      concurrency: body.concurrency || 5,
      cpuUsage: body.cpuUsage || 10,
      memoryUsage: body.memoryUsage || 15,
      lastActive: now,
      lastHeartbeatAt: now, // Track exact SDK heartbeat receipt time
    };

    // Save worker health report to DB
    await this.dbService.saveWorker(report, projectId);

    // Discover SRE service mapping from heartbeat telemetry
    await this.dbService.discoverService(projectId, body.serviceName, body.queueName, report.workerId);

    this.wsGateway.broadcast('worker.health.updated', [{ ...report, projectId }]);
    return { success: true };
  }

  @Post('deployments')
  @ApiOperation({ summary: 'Ingest deployment event from SDK' })
  async ingestDeployment(
    @Headers('authorization') authHeader: string,
    @Body() body: {
      projectId: string;
      service: string;
      version: string;
      commitSha: string;
      branch?: string;
      environment?: string;
      deployedBy?: string;
      metadata?: any;
    }
  ) {
    const projectId = body.projectId;
    await this.authorize(authHeader, projectId);

    // Mark project as telemetry received
    await this.dbService.markProjectTelemetryReceived(projectId);

    const event: DeploymentEvent = {
      id: `dep_${Math.random().toString(36).substr(2, 9)}`,
      version: body.version || 'v1.0.0',
      service: body.service || 'unknown-service',
      commitSha: body.commitSha || 'unknown',
      branch: body.branch,
      environment: body.environment || 'production',
      deployedBy: body.deployedBy || 'Unknown',
      deployedAt: Date.now(),
      metadata: body.metadata || {},
    };

    await this.dbService.saveDeploymentEvent(event, projectId);
    this.wsGateway.broadcast('deployment.created', { ...event, projectId });
    return { success: true, event };
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
