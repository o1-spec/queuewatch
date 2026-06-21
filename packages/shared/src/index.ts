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
  investigationGraph?: InvestigationGraph;
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
  evidence?: string;
  hypotheses?: string[];
  resolutionTimeMin?: number;
  blastRadius?: string[];
  reliabilityImpact?: string;
  runbooksExecuted?: string[];
  finalOutcome?: string;
  recoveryTime?: number;
  lessonsLearned?: {
    whatHappened: string;
    whatFixedIt: string;
    differentlyNextTime: string;
  };
}

export interface Runbook {
  id: string;
  incidentType: string;
  title: string;
  steps: string[];
  linkedIncidentIds: string[];
  createdAt: number;
}

export interface RunbookStepStatus {
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'blocked';
  updatedAt: number;
}

export interface IncidentRunbook {
  id: string;
  incidentId: string;
  title: string;
  difficulty: 'low' | 'medium' | 'high';
  recoveryTimeMin: number;
  riskLevel: 'low' | 'medium' | 'high';
  steps: RunbookStepStatus[];
}

export interface RecurringIncident {
  id: string;
  pattern: string;
  frequency: number;
  lastOccurrence: number;
  rootCause: string;
  recommendedPrevention: string;
  incidentIds: string[];
  occurrences?: number;
  averageRecoveryTime?: number;
  recommendedResolution?: string;
  successRate?: number;
}

export interface EvidenceItem {
  id: string;
  type: 'log' | 'metric' | 'deployment' | 'incident' | 'score' | 'graph';
  rank: 'primary' | 'secondary' | 'context';
  message: string;
  timestamp?: number;
  metadata?: any;
}

export interface CopilotHypothesis {
  id: string;
  title: string;
  description: string;
  confidence: number; // percentage (0-100)
  evidenceIds: string[]; // associated evidence items backing this hypothesis
}

export interface InvestigationGraphNode {
  id: string;
  type: 'deployment' | 'metric' | 'log' | 'incident' | 'impact' | 'runbook' | 'recovery' | 'blast_radius' | 'action';
  label: string;
  timestamp?: number;
  metadata?: any;
}

export interface InvestigationGraph {
  nodes: InvestigationGraphNode[];
  edges: {
    from: string;
    to: string;
    confidence?: number;
    rationale?: string;
  }[];
}

export interface ActionRecommendation {
  type: 'pause_queue' | 'replay_dlq' | 'reduce_concurrency' | 'ack_incident' | 'scale_workers' | 'investigate_deployment';
  queueName?: string;
  incidentId?: string;
  description: string;
  command?: string;
  payload?: any;
  associatedRunbook?: string;
  reasoning?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  expectedOutcome?: string;
}

export interface CopilotResponse {
  answer: string;
  confidence: 'low' | 'medium' | 'high';
  confidenceScore: number;
  evidence: EvidenceItem[];
  recommendedActions: ActionRecommendation[];
  requiresConfirmation: boolean;
  hypotheses: CopilotHypothesis[];
  investigationGraph: InvestigationGraph;
  relatedIncidents?: string[];
  relatedDeployments?: string[];
}

export interface CopilotLogEntry {
  id: string;
  question: string;
  contextUsed: any;
  evidence: EvidenceItem[];
  answer: string;
  confidence: 'low' | 'medium' | 'high';
  timestamp: number;
  incidentId?: string;
  queueName?: string;
  hypotheses?: CopilotHypothesis[];
  investigationGraph?: InvestigationGraph;
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
  contributors?: {
    failureRate: number;
    latency: number;
    workerHealth: number;
    incidents: number;
    blastRadius: number;
    deployments: number;
  };
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

export interface ForecastTimeframe {
  timeframe: '1h' | '6h' | '24h';
  incidentProbability: number; // 0-100%
  reliabilityScoreTrajectory: number[]; // projected score sequence
  blastRadiusPotential: string[]; // downstream queue or service names
}

export interface ReliabilityForecast {
  targetId: string; // queue name or service ID
  targetType: 'queue' | 'service';
  forecasts: ForecastTimeframe[];
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

// ─── Phase 3.0 Reliability Agent ─────────────────────────────────────────────

export interface AgentPlan {
  strategy: string;
  steps: string[];
  targetQueue: string;
  targetService?: string;
}

export interface AgentHypothesis {
  id: string;
  title: string;
  description: string;
  confidence: number; // 0–100
  evidenceIds: string[];
  rank: number; // 1 = primary
}

export interface RunbookMatch {
  runbookId: string;
  title: string;
  matchScore: number; // 0–100
  reason: string;
}

export interface AgentAction {
  id: string;
  type:
    | 'pause_queue'
    | 'resume_queue'
    | 'replay_dlq'
    | 'scale_workers'
    | 'restart_worker'
    | 'rollback_deployment'
    | 'ack_incident'
    | 'resolve_incident'
    | 'reduce_concurrency'
    | 'investigate_deployment'
    | 'trigger_runbook';
  description: string;
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
  expectedOutcome: string;
  estimatedRecoveryMin: number;
  command?: string;
  status: 'pending' | 'approved' | 'rejected' | 'modified' | 'executed';
  associatedRunbook?: string;
  payload?: any;
}

export interface ApprovalDecision {
  actionId: string;
  decision: 'approved' | 'rejected' | 'modified';
  modifiedPayload?: any;
  decidedBy: string;
  decidedAt: number;
  notes?: string;
}

export interface ExecutionEntry {
  actionId: string;
  executedAt: number;
  result: 'success' | 'failed' | 'skipped';
  output?: string;
}

export interface AgentSession {
  id: string;
  incidentId: string;
  projectId: string;
  status:
    | 'planning'
    | 'investigating'
    | 'reasoning'
    | 'awaiting_approval'
    | 'executing'
    | 'completed'
    | 'failed';
  plan: AgentPlan;
  evidence: EvidenceItem[];
  hypotheses: AgentHypothesis[];
  runbookMatches: RunbookMatch[];
  recommendedActions: AgentAction[];
  approvalDecisions: ApprovalDecision[];
  executionHistory: ExecutionEntry[];
  postmortem?: string;
  engineerFeedback?: string;
  startedAt: number;
  completedAt?: number;
  recoveryTimeMin?: number;
  teamFindings?: TeamAgentFinding[];
  consensusReport?: ConsensusReport;
}

// ─── Phase 3.2 Multi-Agent Reliability Team ────────────────────────────────────

export interface TeamAgentFinding {
  agentRole: 'incident_commander' | 'telemetry' | 'deployment' | 'dependency' | 'knowledge' | 'recovery';
  status: 'idle' | 'working' | 'completed' | 'failed';
  findings: string[];
  evidenceItems: EvidenceItem[];
  confidenceScore: number;
  analysis: string;
  suggestedActions?: AgentAction[];
  updatedAt: number;
}

export interface ConsensusReport {
  summary: string;
  agreedRootCause: string;
  overallConfidenceScore: number;
  consensusStrength: 'low' | 'medium' | 'high';
  combinedEvidenceIds: string[];
  recommendedActions: AgentAction[];
  generatedAt: number;
}

// ─── Phase 3.1 Assisted Remediation Engine ────────────────────────────────────

export interface RollbackPlan {
  description: string;           // Human-readable inverse action
  rollbackActionType: AgentAction['type'];
  rollbackPayload?: any;         // Payload for the inverse action
  automatic: boolean;            // Auto-rollback on failure?
}

export interface VerificationResult {
  checkedAt: number;
  passed: boolean;
  improved: boolean;
  failureRateBefore: number;
  failureRateAfter: number;
  latencyBefore: number;
  latencyAfter: number;
  reliabilityScoreBefore: number;
  reliabilityScoreAfter: number;
  incidentStatusBefore: string;
  incidentStatusAfter: string;
  summary: string;
}

export type RemediationStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'succeeded'
  | 'failed'
  | 'rolled_back';

export interface RemediationRecord {
  id: string;
  sessionId?: string;            // Optional link to AgentSession
  incidentId: string;
  projectId: string;
  action: AgentAction;
  rollbackPlan: RollbackPlan;
  status: RemediationStatus;
  approvedBy?: string;
  approvedAt?: number;
  rejectedBy?: string;
  rejectedAt?: number;
  executedAt?: number;
  completedAt?: number;
  verificationResult?: VerificationResult;
  executionLog: string[];
  timelineEventIds: string[];    // IDs of timeline events appended
  createdAt: number;
}
