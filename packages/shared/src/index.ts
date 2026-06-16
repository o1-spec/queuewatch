export type QueueName = string;

export type JobStatus =
  | 'waiting'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'retried'
  | 'stalled'
  | 'dead-letter';

// ─── Retention ────────────────────────────────────────────────────────────────

export type RetentionTier = '7d' | '30d' | '90d';

export interface RetentionPolicy {
  tier: RetentionTier;
  telemetryDays: number;
  logsDays: number;
  incidentDays: number; // resolved incidents only
  updatedAt?: number;
}

export interface PurgeResult {
  projectId: string;
  incidentsPurged: number;
  investigationsPurged: number;
  commentsPurged: number;
  prunedAt: number;
}

// ─── Core types ───────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  role?: string;
}

export interface TelemetryEvent {
  id: string;
  type:
    | 'job.created'
    | 'job.active'
    | 'job.completed'
    | 'job.failed'
    | 'job.retried'
    | 'job.stalled'
    | 'job.delayed'
    | 'job.deadlettered'
    | 'worker.status';
  queueName: QueueName;
  jobId?: string;
  jobName?: string;
  workerId?: string;
  status?: JobStatus | 'online' | 'offline';
  latency?: number;
  duration?: number;
  errorMessage?: string;
  attemptsMade?: number;
  maxAttempts?: number;
  timestamp: number;
  payload?: any;
  traceId?: string;
  serviceName?: string;
}

export interface QueueMetrics {
  queueName: QueueName;
  waitingCount: number;
  activeCount: number;
  completedCount: number;
  failedCount: number;
  delayedCount: number;
  paused: boolean;
  throughput: number; // completed jobs per minute
  averageLatency: number; // processing duration in ms
  timestamp: number;
}

export interface WorkerHealth {
  workerId: string;
  queueName: QueueName;
  status: 'healthy' | 'overloaded' | 'down';
  concurrency: number;
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  lastActive: number; // timestamp
}

export interface Incident {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedQueue: QueueName;
  fingerprint?: string;
  status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'ignored';
  firstDetectedAt: number;
  lastUpdatedAt: number;
  summary: string;
  evidence: string;
  suspectedRootCause: string;
  recommendation: string;
  impact: string;
  relatedErrors: string[];
  assigneeId?: string;
  acknowledgedAt?: number;
  resolvedAt?: number;
  escalatedAt?: number;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  responseOwner?: string;
  resolutionSummary?: string;
  githubIssueUrl?: string;
  jiraTicketUrl?: string;
}

export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  queueName: QueueName;
  workerName?: string;
  timestamp: number;
  metadata?: any;
  traceId?: string;
  jobId?: string;
  serviceName?: string;
}

export interface InvestigationReport {
  id: string;
  incidentId: string;
  rootCause: string;
  evidence: string[];
  impact: string;
  confidenceScore: number;
  recommendedActions: string[];
  timelineSummary: string;
  nextSteps: string[];
  timestamp: number;
}

export interface AlertRule {
  id: string;
  name: string;
  queueName: QueueName;
  metric:
    | 'failureRate'
    | 'retryRate'
    | 'backlog'
    | 'avgLatency'
    | 'deadLetterCount'
    | 'workerHealthScore';
  operator: '>' | '<' | '==';
  threshold: number;
  durationSeconds: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export interface AlertNotification {
  id: string;
  ruleId: string;
  message: string;
  timestamp: number;
}

export interface DeadLetterJob {
  id: string;
  queueName: QueueName;
  jobId: string;
  jobName: string;
  payload: any;
  failedReason: string;
  stackTrace: string[];
  attemptsMade: number;
  maxAttempts: number;
  timestamp: number;
  replayStatus: 'pending' | 'replayed' | 'resolved';
  relatedIncidentId?: string;
}

export interface IncidentComment {
  id: string;
  incidentId: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: number;
}

export interface EscalationRule {
  id: string;
  name: string;
  queueName: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | 'all';
  condition: string;
  delayMinutes: number;
  channels: string[];
  enabled: boolean;
}

export interface DeploymentEvent {
  id: string;
  version: string;
  service: string;
  commitSha: string;
  branch?: string;
  environment: string;
  deployedBy: string;
  deployedAt: number;
  metadata?: any;
}

export interface NotificationSetting {
  emailEnabled: boolean;
  dashboardEnabled: boolean;
  webhookEnabled: boolean;
  slackWebhookUrl?: string;
  discordWebhookUrl?: string;
  severities: string[];
  queues: string[];
}

export interface Notification {
  id: string;
  incidentId?: string;
  message: string;
  severity?: string;
  queueName?: string;
  channel: 'dashboard' | 'email' | 'slack_webhook' | 'discord_webhook';
  status: 'sent' | 'failed';
  timestamp: number;
}

export interface KnowledgeEntry {
  id: string;
  title: string;
  incidentId: string;
  pattern: string;
  rootCause: string;
  resolution: string;
  preventionRecommendation: string;
  createdAt: number;
}

export interface Runbook {
  id: string;
  incidentType: string;
  title: string;
  steps: string[];
  linkedIncidentIds: string[];
  createdAt: number;
}

export interface RecurringIncident {
  id: string;
  pattern: string;
  frequency: number;
  lastOccurrence: number;
  rootCause: string;
  recommendedPrevention: string;
  incidentIds: string[];
}

export interface CopilotResponse {
  answer: string;
  evidence: string[];
  confidenceScore: number;
  recommendedActions: string[];
  relatedIncidents: string[];
  relatedDeployments: string[];
}

export interface Environment {
  id: string;
  name: string;
  type: 'production' | 'staging' | 'development';
}

export interface Service {
  id: string;
  name: string;
  description: string;
  environment: string;
  owner: string;
  status: 'healthy' | 'degraded' | 'critical';
  createdAt: number;
  queues: string[];
  workers: string[];
  deployments: string[];
  incidents: string[];
  businessCapability?: string;
}

export interface DependencyGraph {
  nodes: { id: string; label: string; type: 'service' | 'queue' | 'worker' }[];
  edges: { from: string; to: string; observations?: number }[];
  serviceImpacts: Record<string, string[]>;
}

export interface ReliabilityScore {
  id: string;
  targetId: string;
  targetType: 'queue' | 'service' | 'environment';
  score: number;
  failureRate: number;
  retryRate: number;
  backlogGrowth: number;
  workerHealthScore: number;
  incidentFrequency: number;
  mttrMinutes: number;
  timestamp: number;
}

export interface Prediction {
  id: string;
  title: string;
  riskScore: number;
  confidenceScore: number;
  estimatedImpact: string;
  recommendedActions: string[];
  reason: string;
  targetQueue?: string;
  targetService?: string;
  timestamp: number;
}

export interface GlobalHealth {
  healthyServicesCount: number;
  degradedServicesCount: number;
  criticalServicesCount: number;
  activeIncidentsCount: number;
  unresolvedIncidentsCount: number;
  overallReliabilityScore: number;
  overallRiskScore: number;
  timestamp: number;
}

export interface Project {
  id: string;
  name: string;
  apiKey: string;
  createdAt: number;
  hasReceivedTelemetry?: boolean;
  firstTelemetryAt?: number;
  retention?: RetentionPolicy;
}
