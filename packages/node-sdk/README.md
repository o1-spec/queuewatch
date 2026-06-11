# QueueWatch Node SDK (`@queuewatch/node`)

QueueWatch is an AI-powered operational reliability and diagnostics platform. The QueueWatch Node SDK collects operational telemetry, trace events, worker heartbeats, and structured logs across modern backend systems, distributed services, APIs, and background queues.

BullMQ monitoring is supported out-of-the-box as an automatic integration, alongside generic instrumentation tools for any server, database, cron job, or microservice.

---

## Key Features

- ⚡ **Zero-Crash Resiliency**: Telemetry events are queued and dispatched in the background. If the QueueWatch server is unreachable or offline, the SDK fails silently without crashing or slowing down host application threads.
- 📦 **Automated Event Batching**: Telemetry payloads are buffered and dispatched in batches (every 1 second or when the buffer reaches 20 events) to minimize HTTP overhead.
- 🌐 **Express API Middleware**: Automatically tracks request volumes, latencies, status codes, and 5xx route failures.
- 💥 **Automatic Crash Reporting**: Intercepts uncaught exceptions and unhandled promise rejections, flushing buffered telemetry to QueueWatch before letting the process exit.
- 🔗 **Distributed Trace IDs**: Correlates transactions across multi-service chains (e.g. checkout API -> background worker -> invoice service -> email delivery).
- 🏢 **Service Registration**: Registers service versioning, environment configurations (production, staging), and custom metrics to lay the groundwork for service maps.

---

## Installation

Install the package via your package manager. Note that `bullmq` is a peer dependency:

```bash
# Using npm
npm install @queuewatch/node

# Using pnpm
pnpm add @queuewatch/node

# Using Yarn
yarn add @queuewatch/node
```

---

## Quick Start & Setup

### 1. Initialize the Client

Initialize the client with your project credentials. We recommend setting these via environment variables or passing them directly to the constructor.

#### Environment Variables

```ini
QUEUEWATCH_PROJECT_ID=proj_xxxxxxxxxxxxxx
QUEUEWATCH_API_KEY=qw_api_xxxxxxxxxxxxxxxx
QUEUEWATCH_ENDPOINT=https://api.queuewatch.dev  # Optional, defaults to http://localhost:3001
QUEUEWATCH_SERVICE=payment-service             # Optional default service/application name
```

#### Code Initialization

```typescript
import { QueueWatch } from '@queuewatch/node';

// Create a new instance
const queuewatch = new QueueWatch({
  projectId: 'your_project_id',
  apiKey: 'your_api_key',
  endpoint: 'https://api.queuewatch.dev', // optional
  service: 'payment-service'              // optional default service name
});
```

---

## Core Capabilities

### 1. Service Map Registration

Register your backend services to configure environments, versioning, and build topology maps:

```typescript
queuewatch.registerService({
  service: 'payment-service',
  environment: 'production',
  version: '1.4.2',
  metadata: { region: 'us-east-1' }
});
```

---

### 2. Automatic BullMQ Queue Monitoring

Track queue performance, worker throughput, and job statuses automatically:

```typescript
import { Queue } from 'bullmq';

const myQueue = new Queue('email_delivery', {
  connection: { host: '127.0.0.1', port: 6379 }
});

// Pass the queue instance to monitor it
const stop = queuewatch.monitorQueue(myQueue, {
  queueName: 'email_delivery' // optional
});

// Close listeners cleanly during application shutdowns (SIGTERM / SIGINT)
process.on('SIGTERM', async () => {
  await stop();
  process.exit(0);
});
```

---

### 3. Express API Middleware (HTTP Telemetry)

Automatically measure API request latency, traffic spikes, route paths, and HTTP failure codes:

```typescript
import express from 'express';
import { queuewatch } from '@queuewatch/node'; // Uses global pre-configured client

const app = express();

// Enable express middleware
app.use(queuewatch.express());

app.get('/checkout', (req, res) => {
  res.json({ success: true });
});
```

---

### 4. Automatic Crash Reporting

Capture unhandled exceptions and promise rejections automatically. It flushes telemetry buffers before exiting, ensuring crashes appear on your QueueWatch dashboard:

```typescript
// Call once at startup
queuewatch.enableCrashReporting();
```

---

### 5. Generic Event & Workflow Tracking (Non-BullMQ)

Trace manual workflows, custom cron tasks, or background functions:

#### Track Workflows and Trace IDs

Trace custom workflows and pass correlated `traceId` values to reconstruct transactional paths:

```typescript
const orderId = 'ord_7482';
const traceId = queuewatch.generateTraceId();

try {
  // 1. Mark workflow step active
  queuewatch.trackWorkflow({
    workflow: 'order_checkout',
    status: 'active',
    step: 'payment_verification',
    referenceId: orderId,
    traceId
  });

  await processPayment(orderId);

  // 2. Mark workflow step complete
  queuewatch.trackWorkflow({
    workflow: 'order_checkout',
    status: 'completed',
    step: 'payment_verification',
    referenceId: orderId,
    traceId
  });
} catch (error) {
  // 3. Capture exception with workflow context
  queuewatch.captureError(error, {
    workflow: 'order_checkout',
    step: 'payment_verification',
    referenceId: orderId,
    traceId
  });
  throw error;
}
```

#### Heartbeats for Custom Workers

For non-BullMQ workers or custom cron jobs, register health check-ins periodically (every 10–15s):

```typescript
setInterval(() => {
  queuewatch.heartbeat({
    service: 'sitemap-cron',
    workerId: 'aws_worker_01',
    status: 'healthy'
  });
}, 15000);
```

---

### 6. Structured Application Logs

Stream application logs directly into the QueueWatch diagnostics panel:

```typescript
import { queuewatchLogger } from '@queuewatch/node';

queuewatchLogger.info('Sitemap generated successfully', { service: 'sitemap-cron' });
queuewatchLogger.warn('Secondary API connection timeout, retrying', { service: 'api-gateway' });
queuewatchLogger.error('Failed to update inventory quantity', {
  service: 'inventory-service',
  error: 'DB locked'
});
```

---

## Resiliency & Troubleshooting

- **No telemetry is appearing in my dashboard:**
  - Double check that `QUEUEWATCH_PROJECT_ID` and `QUEUEWATCH_API_KEY` are defined.
  - The SDK prints console warning messages in non-production environments if configuration parameters are missing during initialization. Check your server startup logs.
- **Underlying connections are not closing:**
  - Make sure to call and wait for the `stop()` function returned by `monitorQueue` or run `await queuewatch.cleanup()` when terminating your application process.
