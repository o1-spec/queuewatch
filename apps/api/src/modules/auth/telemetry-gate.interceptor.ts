import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { DbService } from '../db/db.service';

@Injectable()
export class TelemetryGateInterceptor implements NestInterceptor {
  constructor(private readonly dbService: DbService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const url = request.url;

    // Check if the URL is a non-dashboard API endpoint or a non-GET method
    const isBypassUrl =
      url.includes('/ingest') ||
      url.includes('/auth') ||
      url.includes('/projects') ||
      url.includes('/simulation') ||
      url.includes('/notifications/settings') ||
      url.includes('/escalation-rules') ||
      url.includes('/alert-rules') ||
      url === '/health' ||
      url === '/api/health' ||
      url.startsWith('/health?') ||
      url.startsWith('/api/health?');

    if (isBypassUrl || request.method !== 'GET') {
      return next.handle();
    }

    const projectId = request.headers['x-project-id'] || request.query?.projectId || request.body?.projectId;
    if (!projectId || projectId === 'proj_demo') {
      return next.handle();
    }

    // Retrieve active project details
    const project = await this.dbService.getProject(projectId);
    if (project && project.hasReceivedTelemetry) {
      return next.handle();
    }

    // Project has not received telemetry yet, return clean/empty dashboard state
    if (url.includes('/health-center')) {
      return of({
        healthyServicesCount: 0,
        degradedServicesCount: 0,
        criticalServicesCount: 0,
        activeIncidentsCount: 0,
        unresolvedIncidentsCount: 0,
        overallReliabilityScore: 100,
        overallRiskScore: 0,
        timestamp: Date.now(),
      });
    }

    if (url.includes('/graph')) {
      return of({
        nodes: [],
        edges: [],
        serviceImpacts: {},
      });
    }

    if (url.includes('/analytics')) {
      return of({
        incidentsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        mttrMinutes: 0,
        topRecurringIssues: [],
        deploymentStabilityRate: 100,
        queuePerformance: [],
        serviceReliability: [],
      });
    }

    // Default response for other SRE lists/arrays
    return of([]);
  }
}
