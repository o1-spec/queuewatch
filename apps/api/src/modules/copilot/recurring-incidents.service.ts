import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { RecurringIncident } from '@queuewatch/shared';

@Injectable()
export class RecurringIncidentsService {
  private readonly logger = new Logger(RecurringIncidentsService.name);

  constructor(private readonly dbService: DbService) {}

  async getRecurringIncidents(): Promise<RecurringIncident[]> {
    const list = await this.dbService.getIncidents();
    const groups: Record<string, typeof list> = {};

    // Group incidents by matching patterns in their title
    for (const inc of list) {
      let pattern = 'General Anomalous Outage';
      if (inc.title.toLowerCase().includes('offline')) {
        pattern = 'Worker Offline/Down Bottlenecks';
      } else if (inc.title.toLowerCase().includes('failure rate') || inc.title.toLowerCase().includes('failed')) {
        pattern = 'Spiking Job Execution Failures';
      } else if (inc.title.toLowerCase().includes('backlog') || inc.title.toLowerCase().includes('latency')) {
        pattern = 'Worker Latency SLA Overload';
      }

      if (!groups[pattern]) {
        groups[pattern] = [];
      }
      groups[pattern].push(inc);
    }

    const result: RecurringIncident[] = [];
    let idCounter = 1;

    for (const [pattern, items] of Object.entries(groups)) {
      if (items.length < 1) continue; // Only report patterns with occurrences

      const sorted = [...items].sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
      const lastOcc = sorted[0];

      result.push({
        id: `rec_${idCounter++}`,
        pattern,
        frequency: items.length,
        lastOccurrence: lastOcc.lastUpdatedAt,
        rootCause: lastOcc.suspectedRootCause || 'Unverified thread resource exception.',
        recommendedPrevention: lastOcc.recommendation || 'Verify health states and review worker stack trace files.',
        incidentIds: items.map(i => i.id),
      });
    }

    return result;
  }

  async getRecurringIncidentById(id: string): Promise<RecurringIncident> {
    const all = await this.getRecurringIncidents();
    const found = all.find(r => r.id === id);
    if (!found) {
      throw new NotFoundException(`Recurring incident pattern ${id} not found`);
    }
    return found;
  }
}
