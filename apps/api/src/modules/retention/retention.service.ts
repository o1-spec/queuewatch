import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RetentionPolicy, RetentionTier, PurgeResult } from '@queuewatch/shared';
import { DbService } from '../db/db.service';

// ─── Tier definitions ─────────────────────────────────────────────────────────

const TIER_DEFINITIONS: Record<RetentionTier, Omit<RetentionPolicy, 'updatedAt'>> = {
  '7d': { tier: '7d', telemetryDays: 7, logsDays: 7, incidentDays: 7 },
  '30d': { tier: '30d', telemetryDays: 30, logsDays: 30, incidentDays: 30 },
  '90d': { tier: '90d', telemetryDays: 90, logsDays: 90, incidentDays: 90 },
};

export const DEFAULT_TIER: RetentionTier = '30d';

// Worker heartbeats: always 24h regardless of project tier
export const WORKER_TTL_SECONDS = 86_400;

@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private purgeTimer: NodeJS.Timeout;

  // In-memory cache of resolved policies to avoid Redis hits on every write
  private policyCache = new Map<string, RetentionPolicy>();

  constructor(private readonly dbService: DbService) {}

  onModuleInit() {
    // Wire ourselves back into DbService (breaks circular module dep)
    this.dbService.setRetentionService(this);

    // Run first purge sweep 60s after boot, then every 6 hours
    setTimeout(() => this.runAllProjectsPurge(), 60_000);
    this.purgeTimer = setInterval(() => this.runAllProjectsPurge(), 6 * 60 * 60 * 1000);
    this.logger.log('Retention service active. Sweep interval: 6h.');
  }

  onModuleDestroy() {
    if (this.purgeTimer) clearInterval(this.purgeTimer);
  }

  // ─── Policy resolution ──────────────────────────────────────────────────────

  async getPolicy(projectId: string): Promise<RetentionPolicy> {
    const cached = this.policyCache.get(projectId);
    if (cached) return cached;

    const stored = await this.dbService.getRetentionPolicy(projectId);
    const policy = stored ?? { ...TIER_DEFINITIONS[DEFAULT_TIER], updatedAt: Date.now() };
    this.policyCache.set(projectId, policy);
    return policy;
  }

  async setPolicy(projectId: string, tier: RetentionTier): Promise<RetentionPolicy> {
    const policy: RetentionPolicy = { ...TIER_DEFINITIONS[tier], updatedAt: Date.now() };
    await this.dbService.saveRetentionPolicy(projectId, policy);
    this.policyCache.set(projectId, policy);
    this.logger.log(`[Retention] Project ${projectId} → tier set to ${tier}`);
    return policy;
  }

  // ─── TTL helpers (used by DbService on write) ───────────────────────────────

  async getTtlSeconds(projectId: string, dataType: 'telemetry' | 'logs' | 'notifications' | 'deployments'): Promise<number> {
    const policy = await this.getPolicy(projectId);
    switch (dataType) {
      case 'telemetry':    return policy.telemetryDays * 86_400;
      case 'logs':         return policy.logsDays * 86_400;
      case 'notifications': return policy.logsDays * 86_400; // same window as logs
      case 'deployments':  return policy.telemetryDays * 86_400; // same window as telemetry
    }
  }

  // ─── Usage stats (for Settings UI) ─────────────────────────────────────────

  async getUsageStats(projectId: string): Promise<{
    telemetryCount: number;
    logCount: number;
    incidentCount: number;
    resolvedIncidentCount: number;
    workerCount: number;
    policy: RetentionPolicy;
  }> {
    const [policy, incidents, workers] = await Promise.all([
      this.getPolicy(projectId),
      this.dbService.getIncidents(projectId),
      this.dbService.getWorkers(projectId),
    ]);

    // Count list lengths directly from Redis via DbService
    const [telemetryCount, logCount] = await Promise.all([
      this.dbService.countTelemetry(projectId),
      this.dbService.countLogs(projectId),
    ]);

    return {
      telemetryCount,
      logCount,
      incidentCount: incidents.length,
      resolvedIncidentCount: incidents.filter(i => i.status === 'resolved').length,
      workerCount: workers.length,
      policy,
    };
  }

  // ─── Purge ──────────────────────────────────────────────────────────────────

  async runPurge(projectId: string): Promise<PurgeResult> {
    const policy = await this.getPolicy(projectId);
    const cutoffMs = policy.incidentDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const threshold = now - cutoffMs;

    let incidentsPurged = 0;
    let investigationsPurged = 0;
    let commentsPurged = 0;

    const incidents = await this.dbService.getIncidents(projectId);

    for (const incident of incidents) {
      // Only purge resolved incidents past the retention window
      if (incident.status !== 'resolved') continue;
      const resolvedAt = incident.resolvedAt ?? incident.lastUpdatedAt;
      if (resolvedAt > threshold) continue;

      // Delete incident
      await this.dbService.deleteIncident(incident.id, projectId);
      incidentsPurged++;

      // Delete orphaned investigation report
      const investigation = await this.dbService.getInvestigation(incident.id, projectId);
      if (investigation) {
        await this.dbService.deleteInvestigation(incident.id, projectId);
        investigationsPurged++;
      }

      // Delete orphaned comments
      const comments = await this.dbService.getComments(incident.id, projectId);
      for (const comment of comments) {
        await this.dbService.deleteComment(incident.id, comment.id, projectId);
        commentsPurged++;
      }
    }

    const result: PurgeResult = {
      projectId,
      incidentsPurged,
      investigationsPurged,
      commentsPurged,
      prunedAt: now,
    };

    if (incidentsPurged > 0) {
      this.logger.log(
        `[Retention] Purge complete for ${projectId}: ` +
        `${incidentsPurged} incidents, ${investigationsPurged} investigations, ${commentsPurged} comments removed.`
      );
    }

    return result;
  }

  private async runAllProjectsPurge() {
    try {
      const projects = await this.dbService.getAllProjects();
      const ids = projects.length > 0 ? projects.map(p => p.id) : ['proj_demo'];
      for (const id of ids) {
        await this.runPurge(id);
      }
    } catch (err) {
      this.logger.error('Retention sweep failed:', err.message);
    }
  }
}
