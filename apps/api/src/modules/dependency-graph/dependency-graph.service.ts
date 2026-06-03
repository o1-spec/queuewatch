import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { DependencyGraph } from '@queuewatch/shared';

@Injectable()
export class DependencyGraphService {
  private readonly logger = new Logger(DependencyGraphService.name);

  constructor(private readonly dbService: DbService) {}

  async getGraph(): Promise<DependencyGraph> {
    return this.dbService.getDependencyGraph();
  }

  async getDependencies(serviceId: string): Promise<{ upstream: string[]; downstream: string[] }> {
    const graph = await this.getGraph();
    const downstream = graph.serviceImpacts[serviceId] || [];
    
    // Compute upstream dynamically by looking for serviceId in downstream lists
    const upstream: string[] = [];
    for (const [key, list] of Object.entries(graph.serviceImpacts)) {
      if (list.includes(serviceId)) {
        upstream.push(key);
      }
    }

    return { upstream, downstream };
  }

  async addDependencyEdge(from: string, to: string): Promise<DependencyGraph> {
    const graph = await this.getGraph();
    // Add edge if not exists
    const exists = graph.edges.some(e => e.from === from && e.to === to);
    if (!exists) {
      graph.edges.push({ from, to });
      // Update impacts
      if (from.startsWith('svc_') && to.startsWith('svc_')) {
        if (!graph.serviceImpacts[from]) graph.serviceImpacts[from] = [];
        if (!graph.serviceImpacts[from].includes(to)) {
          graph.serviceImpacts[from].push(to);
        }
      }
      await this.dbService.saveDependencyGraph(graph);
    }
    return graph;
  }
}
