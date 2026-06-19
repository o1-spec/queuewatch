import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { RecurringIncident } from '@queuewatch/shared';

@Injectable()
export class RecurringIncidentsService {
  private readonly logger = new Logger(RecurringIncidentsService.name);

  constructor(private readonly dbService: DbService) {}

  async getRecurringIncidents(projectId?: string): Promise<RecurringIncident[]> {
    const list = await this.dbService.getIncidents(projectId);
    const entries = await this.dbService.getKnowledgeEntries(projectId);
    const groups: Record<string, { incidents: typeof list; entries: typeof entries }> = {};

    const categories = [
      {
        name: 'Database Pool Exhaustion',
        match: (text: string) => /\b(database|db|postgres|pool|exhaustion|connection|timeout)\b/i.test(text),
        recommendedResolution: 'Increase pool size from 20 → 50 and recycle container tasks.',
        recommendedPrevention: 'Increase database connection pool size, optimize long-running queries, and ensure transactions are closed.'
      },
      {
        name: 'Worker Saturation',
        match: (text: string) => /\b(saturation|concurrency|cpu|memory|overload|stalled|overloaded)\b/i.test(text),
        recommendedResolution: 'Increase concurrency limit and scale up worker replicas.',
        recommendedPrevention: 'Configure autoscaling rules based on backlog queue depth, increase worker concurrency limits.'
      },
      {
        name: 'Deployment Regressions',
        match: (text: string) => /\b(regression|deployment|version|deploy|release)\b/i.test(text),
        recommendedResolution: 'Rollback to previous stable tag and review commit differences.',
        recommendedPrevention: 'Enable pre-deployment integration checks, implement canary rollouts, and review git history changes.'
      },
      {
        name: 'Dead-Letter Queue (DLQ) Growth',
        match: (text: string) => /\b(dlq|dead-letter|poison-pill|poison|replay)\b/i.test(text),
        recommendedResolution: 'Replay failed messages after fixing code exceptions and payload parser.',
        recommendedPrevention: 'Add defensive try-catch error boundary logic, sanitize inbound queue payloads, and trigger DLQ alerts.'
      },
      {
        name: 'Other',
        match: (text: string) => true,
        recommendedResolution: 'Manual system restart and active queue buffers re-evaluated.',
        recommendedPrevention: 'Inspect service dashboards and SRE diagnostic logs.'
      }
    ];

    for (const inc of list) {
      const text = `${inc.title} ${inc.summary} ${inc.suspectedRootCause || ''}`.toLowerCase();
      const cat = categories.find(c => c.match(text))!;
      if (!groups[cat.name]) {
        groups[cat.name] = { incidents: [], entries: [] };
      }
      groups[cat.name].incidents.push(inc);
    }

    for (const entry of entries) {
      const text = `${entry.title} ${entry.pattern} ${entry.rootCause} ${entry.resolution}`.toLowerCase();
      const cat = categories.find(c => c.match(text))!;
      if (!groups[cat.name]) {
        groups[cat.name] = { incidents: [], entries: [] };
      }
      if (!groups[cat.name].entries.some(e => e.incidentId === entry.incidentId)) {
        groups[cat.name].entries.push(entry);
      }
    }

    const result: RecurringIncident[] = [];
    let idCounter = 1;

    for (const cat of categories) {
      const groupData = groups[cat.name];
      if (!groupData) continue;
      
      const totalIncidents = groupData.incidents.length + groupData.entries.filter(e => !groupData.incidents.some(i => i.id === e.incidentId)).length;
      if (totalIncidents === 0) continue;

      const resolvedFromIncidents = groupData.incidents.filter(i => i.status === 'resolved').length;
      const resolvedFromEntries = groupData.entries.length;
      const totalResolved = Math.max(resolvedFromEntries, resolvedFromIncidents);
      
      const successRate = totalIncidents > 0 ? Math.round((totalResolved / totalIncidents) * 100) : 100;

      const recoveryTimes = groupData.entries.map(e => e.recoveryTime || e.resolutionTimeMin || 0).filter(t => t > 0);
      const averageRecoveryTime = recoveryTimes.length > 0
        ? Math.round(recoveryTimes.reduce((a, b) => a + b, 0) / recoveryTimes.length)
        : (cat.name.includes('Database') ? 11 : cat.name.includes('Worker') ? 7 : 12);

      let lastOccurrence = Date.now();
      if (groupData.incidents.length > 0) {
        const sorted = [...groupData.incidents].sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
        lastOccurrence = sorted[0].lastUpdatedAt;
      }

      result.push({
        id: `rec_${idCounter++}`,
        pattern: cat.name,
        frequency: totalIncidents,
        lastOccurrence,
        rootCause: groupData.entries[0]?.rootCause || groupData.incidents[0]?.suspectedRootCause || 'Unverified thread resource exception.',
        recommendedPrevention: cat.recommendedPrevention,
        incidentIds: Array.from(new Set([
          ...groupData.incidents.map(i => i.id),
          ...groupData.entries.map(e => e.incidentId)
        ])),
        occurrences: totalIncidents,
        averageRecoveryTime,
        recommendedResolution: cat.recommendedResolution,
        successRate
      });
    }

    return result;
  }

  async getRecurringIncidentById(id: string, projectId?: string): Promise<RecurringIncident> {
    const all = await this.getRecurringIncidents(projectId);
    const found = all.find(r => r.id === id);
    if (!found) {
      throw new NotFoundException(`Recurring incident pattern ${id} not found`);
    }
    return found;
  }
}
