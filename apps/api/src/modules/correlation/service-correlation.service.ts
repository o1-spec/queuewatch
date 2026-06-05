import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { DependencyGraphService } from '../dependency-graph/dependency-graph.service';

@Injectable()
export class ServiceCorrelationService {
  private readonly logger = new Logger(ServiceCorrelationService.name);

  constructor(
    private readonly dbService: DbService,
    private readonly depGraphService: DependencyGraphService
  ) {}

  async calculateBlastRadius(incidentId: string, projectId?: string): Promise<{
    impactedServices: string[];
    impactedQueues: string[];
    estimatedBlastRadius: 'low' | 'medium' | 'high' | 'critical';
    blastDescription: string;
  }> {
    const incident = await this.dbService.getIncident(incidentId, projectId);
    if (!incident) {
      return { impactedServices: [], impactedQueues: [], estimatedBlastRadius: 'low', blastDescription: 'Incident context not found.' };
    }

    const graph = await this.depGraphService.getGraph(projectId);
    const impactedQueues: string[] = [incident.affectedQueue];
    const impactedServices: string[] = [];

    // Find services linked to this queue
    const linkedServices = graph.nodes
      .filter(n => n.type === 'service')
      .map(n => n.id);

    // Heuristically map downstream dependencies from the graph edges
    const visited = new Set<string>();
    const queue: string[] = [incident.affectedQueue];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      // Find edges downstream
      const downstreams = graph.edges
        .filter(e => e.from === current)
        .map(e => e.to);

      for (const down of downstreams) {
        if (!visited.has(down)) {
          queue.push(down);
          if (down.startsWith('svc_')) {
            const svcNode = graph.nodes.find(n => n.id === down);
            if (svcNode && !impactedServices.includes(svcNode.label)) {
              impactedServices.push(svcNode.label);
            }
          } else {
            if (!impactedQueues.includes(down)) {
              impactedQueues.push(down);
            }
          }
        }
      }
    }

    // Determine impact scale
    let estimatedBlastRadius: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (impactedServices.length > 2) estimatedBlastRadius = 'critical';
    else if (impactedServices.length > 0) estimatedBlastRadius = 'high';
    else if (impactedQueues.length > 1) estimatedBlastRadius = 'medium';

    const blastDescription = `Failures on queue '${incident.affectedQueue}' propagates down to ${impactedServices.join(', ') || 'no other services'}.`;

    return {
      impactedServices,
      impactedQueues,
      estimatedBlastRadius,
      blastDescription
    };
  }
}
