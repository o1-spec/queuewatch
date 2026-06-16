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
    affectedService?: {
      id: string;
      name: string;
      businessCapability?: string;
      description?: string;
    };
    impactedServices: string[];
    impactedQueues: string[];
    estimatedBlastRadius: 'low' | 'medium' | 'high' | 'critical';
    blastDescription: string;
    cascadePath: string[];
    businessImpacts: string[];
    edges: {
      from: string;
      to: string;
      observations: number;
      confidence: 'Weak' | 'Moderate' | 'Strong';
    }[];
    impactedServicesDetails: {
      id: string;
      name: string;
      businessCapability?: string;
      description?: string;
    }[];
  }> {
    const incident = await this.dbService.getIncident(incidentId, projectId);
    if (!incident) {
      return {
        impactedServices: [],
        impactedQueues: [],
        estimatedBlastRadius: 'low',
        blastDescription: 'Incident context not found.',
        cascadePath: [],
        businessImpacts: [],
        edges: [],
        impactedServicesDetails: []
      };
    }

    const graph = await this.depGraphService.getGraph(projectId);
    const allServices = await this.dbService.getServices(projectId);

    const affectedQueue = incident.affectedQueue;
    let affectedServiceNode: any = null;
    const directConsumerEdge = graph.edges.find(e => e.from === affectedQueue && e.to.startsWith('svc_'));
    if (directConsumerEdge) {
      affectedServiceNode = graph.nodes.find(n => n.id === directConsumerEdge.to);
    }
    const directConsumer = allServices.find(s => s.queues && s.queues.includes(affectedQueue));
    
    let affectedService: any = undefined;
    if (affectedServiceNode) {
      const dbSvc = allServices.find(s => s.id === affectedServiceNode.id);
      affectedService = {
        id: affectedServiceNode.id,
        name: dbSvc ? dbSvc.name : affectedServiceNode.label,
        businessCapability: dbSvc ? dbSvc.businessCapability : undefined,
        description: dbSvc ? dbSvc.description : undefined
      };
    } else if (directConsumer) {
      affectedService = {
        id: directConsumer.id,
        name: directConsumer.name,
        businessCapability: directConsumer.businessCapability,
        description: directConsumer.description
      };
    }

    const visited = new Set<string>();
    const queue: string[] = [affectedQueue];
    const cascadePath: string[] = [];
    const impactedQueues: string[] = [affectedQueue];
    const impactedServices: string[] = [];
    const impactedServicesDetails: any[] = [];
    const businessImpacts: string[] = [];

    if (affectedService) {
      if (affectedService.businessCapability) {
        businessImpacts.push(`${affectedService.businessCapability} degraded`);
      } else {
        businessImpacts.push(`${affectedService.name} affected`);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      cascadePath.push(current);

      // Find downstream edges
      const downstreams = graph.edges
        .filter(e => e.from === current)
        .map(e => e.to);

      for (const down of downstreams) {
        if (!visited.has(down)) {
          queue.push(down);
          if (down.startsWith('svc_')) {
            const svcNode = graph.nodes.find(n => n.id === down);
            const svcLabel = svcNode ? svcNode.label : down;
            if (!impactedServices.includes(svcLabel)) {
              impactedServices.push(svcLabel);
            }
            const serviceDetails = allServices.find(s => s.id === down);
            if (serviceDetails) {
              if (!impactedServicesDetails.some(s => s.id === down)) {
                impactedServicesDetails.push({
                  id: serviceDetails.id,
                  name: serviceDetails.name,
                  businessCapability: serviceDetails.businessCapability,
                  description: serviceDetails.description
                });
                if (serviceDetails.businessCapability) {
                  businessImpacts.push(`${serviceDetails.businessCapability} degraded`);
                } else {
                  businessImpacts.push(`${serviceDetails.name} affected`);
                }
              }
            } else if (svcNode) {
              if (!impactedServicesDetails.some(s => s.id === down)) {
                impactedServicesDetails.push({
                  id: down,
                  name: svcLabel
                });
                businessImpacts.push(`${svcLabel} affected`);
              }
            }
          } else {
            if (!impactedQueues.includes(down)) {
              impactedQueues.push(down);
            }
          }
        }
      }
    }

    // Classify edges and confidence
    const cascadeEdges: any[] = [];
    for (const edge of graph.edges) {
      if (visited.has(edge.from) && visited.has(edge.to)) {
        const obs = edge.observations || 0;
        let confidence: 'Weak' | 'Moderate' | 'Strong' = 'Weak';
        if (obs > 50) {
          confidence = 'Strong';
        } else if (obs > 5) {
          confidence = 'Moderate';
        }
        cascadeEdges.push({
          from: edge.from,
          to: edge.to,
          observations: obs,
          confidence
        });
      }
    }

    // Critical-path weighting helper
    const getDownstreamCount = (nodeId: string) => {
      const q = [nodeId];
      const vis = new Set<string>();
      while (q.length > 0) {
        const curr = q.shift()!;
        if (vis.has(curr)) continue;
        vis.add(curr);
        const nextNodes = graph.edges.filter(e => e.from === curr).map(e => e.to);
        for (const n of nextNodes) {
          if (!vis.has(n)) q.push(n);
        }
      }
      return vis.size - 1;
    };

    const downstreamCount = getDownstreamCount(affectedQueue);
    let estimatedBlastRadius: 'low' | 'medium' | 'high' | 'critical' = 'low';

    if (downstreamCount >= 4 || impactedServices.length >= 3) {
      estimatedBlastRadius = 'critical';
    } else if (downstreamCount >= 2 || impactedServices.length >= 2) {
      estimatedBlastRadius = 'high';
    } else if (downstreamCount >= 1 || impactedServices.length >= 1) {
      estimatedBlastRadius = 'medium';
    }

    const uniqueBusinessImpacts = Array.from(new Set(businessImpacts));

    const blastDescription = `Failures on queue '${affectedQueue}' propagates down to ${impactedServices.join(', ') || 'no other services'}.`;

    return {
      affectedService,
      impactedServices,
      impactedQueues,
      estimatedBlastRadius,
      blastDescription,
      cascadePath,
      businessImpacts: uniqueBusinessImpacts,
      edges: cascadeEdges,
      impactedServicesDetails
    };
  }
}
