import { QueueEvents } from 'bullmq';

export interface QueueWatchConfig {
  projectId: string;
  apiKey: string;
  endpoint?: string;
  service?: string; // Default service/application name
}

export interface MonitorOptions {
  projectId?: string;
  apiKey?: string;
  endpoint?: string;
  queueName?: string;
  connection?: any; // BullMQ Redis connection configuration
}

export interface TrackEventOptions {
  type: string;
  service?: string;
  message?: string;
  severity?: 'info' | 'warn' | 'error';
  traceId?: string;
  metadata?: any;
}

export interface HeartbeatOptions {
  service?: string;
  workerId?: string;
  status?: string;
  concurrency?: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

export interface WorkflowOptions {
  workflow?: string;
  workflowName?: string;
  status: 'active' | 'completed' | 'failed';
  step?: string;
  referenceId?: string;
  traceId?: string;
  metadata?: any;
}

export interface CaptureErrorContext {
  service?: string;
  traceId?: string;
  workflow?: string;
  step?: string;
  referenceId?: string;
  metadata?: any;
}

export class QueueWatch {
  private config: { projectId: string; apiKey: string; endpoint: string; service?: string } | null = null;
  private eventQueue: any[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private activeIntervals: NodeJS.Timeout[] = [];
  private activeListeners: QueueEvents[] = [];

  constructor(config?: QueueWatchConfig) {
    if (config) {
      this.init(config);
    } else {
      // Auto-initialize from process.env if available
      const projectId = process.env.QUEUEWATCH_PROJECT_ID;
      const apiKey = process.env.QUEUEWATCH_API_KEY;
      const endpoint = process.env.QUEUEWATCH_ENDPOINT || 'http://localhost:3001';
      const service = process.env.QUEUEWATCH_SERVICE;
      if (projectId && apiKey) {
        this.init({ projectId, apiKey, endpoint, service });
      }
    }
  }

  public init(config: QueueWatchConfig) {
    const endpoint = config.endpoint || process.env.QUEUEWATCH_ENDPOINT || 'http://localhost:3001';
    
    if (!config.projectId || !config.apiKey) {
      console.warn(
        `[QueueWatch SDK] WARNING: Missing configuration keys. projectId: "${config.projectId || ''}", apiKey: "${config.apiKey ? '***' : ''}". SDK telemetry dispatches will be disabled.`
      );
    }
    
    this.config = {
      projectId: config.projectId || '',
      apiKey: config.apiKey || '',
      endpoint: endpoint,
      service: config.service || process.env.QUEUEWATCH_SERVICE,
    };

    if (this.config.projectId && this.config.apiKey) {
      this.verifyConnection();
    }
  }

  private async verifyConnection() {
    const config = this.config;
    if (!config || !config.projectId || !config.apiKey || !config.endpoint) return;

    try {
      const res = await fetch(`${config.endpoint}/api/ingest/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({ projectId: config.projectId }),
      });

      if (res.ok) {
        const data: any = await res.json();
        console.log(`
✓ QueueWatch Connected

Project: ${data.projectName || 'Unknown Project'}
Service: ${config.service || 'default-service'}
Environment: ${process.env.NODE_ENV || 'development'}

Monitoring Active
        `);
      } else {
        console.warn(`[QueueWatch SDK] Connection verification failed: HTTP ${res.status}`);
      }
    } catch (err: any) {
      console.warn(`[QueueWatch SDK] Connection verification warning: ${err.message}`);
    }
  }

  public getConfig() {
    return this.config;
  }

  // Generates a linkable traceId for distributed tracing correlation
  public generateTraceId(): string {
    return `tr_${Math.random().toString(36).substring(2, 11)}${Math.random().toString(36).substring(2, 6)}`;
  }

  // Registers service parameters on this client instance
  public registerService(options: { service: string; environment?: string; version?: string; metadata?: any }) {
    if (this.config) {
      this.config.service = options.service;
    }
    
    this.trackEvent({
      type: 'service.registered',
      service: options.service,
      severity: 'info',
      message: `Registered service ${options.service} (${options.environment || 'development'} v${options.version || '1.0.0'})`,
      metadata: {
        environment: options.environment || 'development',
        version: options.version || '1.0.0',
        ...options.metadata,
      }
    });
  }

  // Express HTTP Request/Response Telemetry Middleware
  public express() {
    return (req: any, res: any, next: any) => {
      const startTime = Date.now();
      const serviceName = this.config?.service || 'express-api';
      const traceId = req.headers['x-trace-id'] || req.headers['x-request-id'] || this.generateTraceId();
      
      // Inject traceId back into request and response headers for downstream services
      req.traceId = traceId;
      res.setHeader('x-trace-id', traceId);

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const status = res.statusCode;
        const path = req.route ? req.route.path : req.path;
        const method = req.method;

        this.trackEvent({
          type: 'http.request',
          service: serviceName,
          severity: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
          message: `HTTP ${method} ${path} -> ${status} (${duration}ms)`,
          traceId,
          metadata: {
            method,
            path,
            statusCode: status,
            durationMs: duration,
            ip: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
          }
        });
      });

      next();
    };
  }

  // Captures uncaught process crashes and rejects
  public enableCrashReporting() {
    process.on('uncaughtException', (error) => {
      this.captureError(error, {
        metadata: { crashType: 'uncaughtException', fatal: true }
      });
      // Flush before letting the process exit
      this.flushEvents().finally(() => {
        console.error('[QueueWatch SDK] Uncaught Exception recorded. Exiting process...');
        process.exit(1);
      });
    });

    process.on('unhandledRejection', (reason) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.captureError(error, {
        metadata: { crashType: 'unhandledRejection', fatal: true }
      });
    });
  }

  public trackEvent(options: TrackEventOptions) {
    const config = this.config;
    if (!config || !config.projectId) return;

    this.enqueueEvent({
      type: options.type,
      status: options.severity || 'info',
      queueName: options.service || config.service || 'default',
      errorMessage: options.message,
      traceId: options.traceId || this.generateTraceId(),
      metadata: options.metadata,
      timestamp: Date.now(),
    });
  }

  public captureError(error: Error | string, context: CaptureErrorContext = {}) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const config = this.config;
    const traceId = context.traceId || this.generateTraceId();

    // Send a structured error log
    this.logger.error(message, {
      ...context,
      traceId,
      stack,
    });

    // Send a high-priority telemetry event
    this.trackEvent({
      type: 'app.error',
      service: context.service || config?.service || 'default',
      message: message,
      severity: 'error',
      traceId,
      metadata: {
        ...context.metadata,
        workflow: context.workflow,
        step: context.step,
        referenceId: context.referenceId,
        stack,
      },
    });
  }

  public trackWorkflow(options: WorkflowOptions) {
    const config = this.config;
    const workflowName = options.workflow || options.workflowName || 'default_workflow';
    const traceId = options.traceId || this.generateTraceId();
    
    this.trackEvent({
      type: `workflow.${options.status}`,
      service: config?.service || 'default',
      message: options.step ? `Workflow step: ${options.step}` : `Workflow: ${workflowName} ${options.status}`,
      severity: options.status === 'failed' ? 'error' : 'info',
      traceId,
      metadata: {
        ...options.metadata,
        workflow: workflowName,
        step: options.step,
        referenceId: options.referenceId,
      },
    });
  }

  public heartbeat(options: HeartbeatOptions) {
    const config = this.config;
    if (!config || !config.projectId) return;

    const payload = {
      projectId: config.projectId,
      queueName: options.service || config.service || 'default',
      workerId: options.workerId || `worker_${options.service || config.service || 'default'}_generic`,
      status: options.status || 'healthy',
      concurrency: options.concurrency || 1,
      cpuUsage: options.cpuUsage || 0,
      memoryUsage: options.memoryUsage || 0,
      timestamp: Date.now(),
    };

    this.sendPayload('/api/ingest/heartbeat', payload);
  }

  public readonly logger = {
    info: (message: string, meta: any = {}) => this.logIngest('info', message, meta),
    warn: (message: string, meta: any = {}) => this.logIngest('warn', message, meta),
    error: (message: string, meta: any = {}) => this.logIngest('error', message, meta),
  };

  private logIngest(level: 'info' | 'warn' | 'error', message: string, meta: any) {
    const config = this.config;
    if (!config || !config.projectId) return;

    const payload = {
      level,
      message,
      queueName: meta.queueName || meta.service || config.service || 'default',
      jobId: meta.jobId,
      traceId: meta.traceId || this.generateTraceId(),
      metadata: meta,
      timestamp: Date.now(),
      projectId: config.projectId,
    };

    this.sendPayload('/api/ingest/logs', payload);
  }

  private enqueueEvent(event: any) {
    const config = this.config;
    if (!config) return;

    this.eventQueue.push({
      ...event,
      projectId: config.projectId,
    });

    // Batch rules: 20 events immediately, or wait 1 second
    if (this.eventQueue.length >= 20) {
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }
      this.flushEvents();
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flushEvents();
      }, 1000);
    }
  }

  public async flushEvents() {
    this.batchTimeout = null;
    const config = this.config;
    if (!config || this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    await this.sendPayload('/api/ingest/events', {
      events: eventsToSend,
      projectId: config.projectId,
    });
  }

  public async sendPayload(path: string, payload: any) {
    const config = this.config;
    if (!config || !config.projectId || !config.apiKey || !config.endpoint) return;

    try {
      const res = await fetch(`${config.endpoint}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        // Fail silently
      }
    } catch (err) {
      // Fail silently: never block parent application threads
    }
  }

  // Internal helper to track heartbeat intervals for stopping
  public registerInterval(interval: NodeJS.Timeout) {
    this.activeIntervals.push(interval);
  }

  // Internal helper to track active QueueEvents listeners for stopping
  public registerListener(listener: QueueEvents) {
    this.activeListeners.push(listener);
  }

  public async cleanup() {
    // Clear all batch timers
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    // Flush remaining events in queue
    if (this.eventQueue.length > 0) {
      await this.flushEvents();
    }
    // Stop all heartbeat intervals
    for (const interval of this.activeIntervals) {
      clearInterval(interval);
    }
    this.activeIntervals = [];

    // Stop all QueueEvents listeners
    for (const listener of this.activeListeners) {
      try {
        await listener.close();
      } catch (err) {
        // Fail silently during cleanup
      }
    }
    this.activeListeners = [];
  }

  // Instance-based automatic BullMQ monitoring method
  public monitorQueue(queue: any, options: MonitorOptions = {}) {
    const projectId = options.projectId || this.config?.projectId || process.env.QUEUEWATCH_PROJECT_ID;
    const apiKey = options.apiKey || this.config?.apiKey || process.env.QUEUEWATCH_API_KEY;
    const endpoint = options.endpoint || this.config?.endpoint || this.config?.endpoint || 'http://localhost:3001';
    const queueName = options.queueName || queue.name;

    if (!projectId) console.warn('[QueueWatch SDK] WARNING: projectId is missing.');
    if (!apiKey) console.warn('[QueueWatch SDK] WARNING: apiKey is missing.');
    if (!endpoint) console.warn('[QueueWatch SDK] WARNING: endpoint is missing.');
    if (!queueName) console.warn('[QueueWatch SDK] WARNING: queueName is missing.');

    // Update instance config programmatically if dynamic credentials are provided
    if (projectId && apiKey) {
      this.init({ projectId, apiKey, endpoint, service: options.queueName || this.config?.service });
    }

    let queueEvents: QueueEvents | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    try {
      // Start worker heartbeat in the background (every 10-15 seconds)
      heartbeatInterval = setInterval(() => {
        this.heartbeat({
          service: queueName,
          workerId: `worker_${queueName}_sdk`,
          status: 'healthy',
        });
      }, 15000);
      
      heartbeatInterval.unref?.();
      this.registerInterval(heartbeatInterval);

      // Setup BullMQ QueueEvents listener
      const connectionOpts = options.connection || queue.opts?.connection;
      queueEvents = new QueueEvents(queue.name, { connection: connectionOpts });
      this.registerListener(queueEvents);

      const commonEventData = (jobId: string, type: string, status: string) => ({
        type,
        service: queueName,
        jobId,
        severity: status === 'failed' ? 'error' as const : 'info' as const,
        traceId: this.generateTraceId(),
      });

      // Capture standard BullMQ events
      queueEvents.on('waiting', ({ jobId }) => {
        this.trackEvent({
          ...commonEventData(jobId, 'job.waiting', 'waiting'),
        });
      });

      queueEvents.on('active', ({ jobId }) => {
        this.trackEvent({
          ...commonEventData(jobId, 'job.active', 'active'),
        });
      });

      queueEvents.on('completed', ({ jobId }) => {
        this.trackEvent({
          ...commonEventData(jobId, 'job.completed', 'completed'),
        });
      });

      queueEvents.on('failed', ({ jobId, failedReason }) => {
        this.trackEvent({
          ...commonEventData(jobId, 'job.failed', 'failed'),
          message: failedReason,
        });
      });

      queueEvents.on('stalled', ({ jobId }) => {
        this.trackEvent({
          ...commonEventData(jobId, 'job.stalled', 'stalled'),
        });
      });

      queueEvents.on('delayed', ({ jobId }) => {
        this.trackEvent({
          ...commonEventData(jobId, 'job.delayed', 'delayed'),
        });
      });

      queueEvents.on('progress', ({ jobId, data }) => {
        this.trackEvent({
          ...commonEventData(jobId, 'job.progress', 'progress'),
          metadata: { progressData: data },
        });
      });

      queueEvents.on('removed', ({ jobId }) => {
        this.trackEvent({
          ...commonEventData(jobId, 'job.removed', 'removed'),
        });
      });

      queueEvents.on('error', (err) => {
        console.warn(`[QueueWatch SDK] QueueEvents listener warning: ${err.message}`);
      });
    } catch (err: any) {
      console.warn(`[QueueWatch SDK] Failed to initialize queue monitoring: ${err.message}`);
    }

    // Return a stop handle to close this queue listener and its heartbeats cleanly
    return async () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      if (queueEvents) {
        try {
          await queueEvents.close();
        } catch (err) {
          // Fail silently
        }
      }
    };
  }
}

// Global default client instance
export const queuewatch = new QueueWatch();

// Backwards compatibility logger export
export const queuewatchLogger = queuewatch.logger;

// Backwards compatibility global function wrapper
export function monitorQueue(queue: any, options: MonitorOptions) {
  return queuewatch.monitorQueue(queue, options);
}
