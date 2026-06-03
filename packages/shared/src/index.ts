export type QueueName =
  | 'email_notifications'
  | 'webhook_delivery'
  | 'image_processing'
  | 'ai_tasks';

export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'retried' | 'stalled' | 'dead-letter';

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
  type: 'job.created' | 'job.active' | 'job.completed' | 'job.failed' | 'job.retried' | 'job.stalled' | 'job.delayed' | 'job.deadlettered' | 'worker.status';
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
  status: 'open' | 'investigating' | 'resolved';
  firstDetectedAt: number;
  lastUpdatedAt: number;
  summary: string;
  evidence: string;
  suspectedRootCause: string;
  recommendation: string;
  impact: string;
  relatedErrors: string[];
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
  metric: 'failureRate' | 'retryRate' | 'backlog' | 'avgLatency' | 'deadLetterCount' | 'workerHealthScore';
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


