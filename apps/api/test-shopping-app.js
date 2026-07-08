const express = require('express');
const { Queue, Worker } = require('bullmq');
const { QueueWatch } = require('../../packages/node-sdk/dist/index.js');

const PORT = 3005;
const REDIS_HOST = 'localhost';
const REDIS_PORT = 6379;
const API_URL = 'http://localhost:3001';

const redisConnection = { host: REDIS_HOST, port: REDIS_PORT };

// 1. Initialize QueueWatch SDK
const qw = new QueueWatch({
  projectId: 'proj_demo',
  apiKey: 'qw_demo_api_key_v2',
  endpoint: API_URL,
  service: 'shopping-service',
});

// Enable automatic process crash reporting
qw.enableCrashReporting();

// 2. Setup BullMQ Queues
const paymentQueue = new Queue('payment_queue', { connection: redisConnection });
const emailQueue = new Queue('email_notifications', { connection: redisConnection });

// 3. Monitor Queues with QueueWatch SDK
console.log('🔌 Registering BullMQ queue listeners inside SDK...');
qw.monitorQueue(paymentQueue);
qw.monitorQueue(emailQueue);

// 4. Initialize Express Application
const app = express();
app.use(express.json());

// Inject QueueWatch HTTP request tracing middleware
app.use(qw.express());

// Route: POST /checkout
app.post('/checkout', async (req, res) => {
  const traceId = req.headers['x-trace-id'] || qw.generateTraceId();
  const fail = req.query.fail || null; // e.g. ?fail=stripe or ?fail=email
  const orderId = `ord_${Math.random().toString(36).substr(2, 9)}`;
  const amount = parseFloat((30 + Math.random() * 120).toFixed(2));

  console.log(`\n🛍️  Received checkout request. Order: ${orderId}, Trace ID: ${traceId}`);

  // Enqueue payment processing task
  await paymentQueue.add('process_payment', {
    orderId,
    amount,
    fail,
    traceId,
  });

  res.json({
    success: true,
    message: 'Checkout initialized. Payment processing enqueued.',
    orderId,
    traceId,
  });
});

// Route: GET /crash (simulate application crash)
app.get('/crash', (req, res) => {
  res.json({ success: true, message: 'Uncaught Exception triggered. App will crash...' });
  setTimeout(() => {
    throw new Error('Fatal exception: Out of Memory trying to parse large payload buffers');
  }, 200);
});

// 5. Setup BullMQ Workers to process jobs
const paymentWorker = new Worker('payment_queue', async (job) => {
  const { orderId, amount, fail, traceId } = job.data;
  console.log(`💳 Processing payment for Order ${orderId} (Amount: $${amount})...`);

  // Simulate payment processing latency
  await new Promise(resolve => setTimeout(resolve, 800));

  if (fail === 'stripe') {
    qw.logger.error(`Stripe API connection timeout after 5000ms trying to charge card for Order ${orderId}`, {
      traceId,
      queueName: 'payment_queue',
    });
    throw new Error('Stripe API unreachable: connection timeout');
  }

  console.log(`✓ Payment successful for Order ${orderId}`);
  
  // Enqueue receipt notification task
  await emailQueue.add('send_receipt', {
    orderId,
    email: 'customer@queuewatch.dev',
    fail,
    traceId,
  });
}, { connection: redisConnection });

const emailWorker = new Worker('email_notifications', async (job) => {
  const { orderId, email, fail, traceId } = job.data;
  console.log(`✉️  Sending receipt email to ${email} for Order ${orderId}...`);

  // Simulate email delivery latency
  await new Promise(resolve => setTimeout(resolve, 500));

  if (fail === 'email') {
    qw.logger.error(`SendGrid SMTP relay returned HTTP 429: Rate Limit Exceeded`, {
      traceId,
      queueName: 'email_notifications',
    });
    throw new Error('SMTP Error: HTTP 429 Rate Limit Exceeded');
  }

  console.log(`✓ Receipt email delivered for Order ${orderId}`);
}, { connection: redisConnection });

// Handle worker error event logging
paymentWorker.on('failed', (job, err) => {
  console.error(`❌ Payment Job ${job.id} failed: ${err.message}`);
});
emailWorker.on('failed', (job, err) => {
  console.error(`❌ Email Job ${job.id} failed: ${err.message}`);
});

// Start Express Server
app.listen(PORT, () => {
  console.log('\n========================================================================');
  console.log(`🚀 Interactive Demo Shopping App running on: http://localhost:${PORT}`);
  console.log('========================================================================');
  console.log('\nUse the following curl commands in a separate terminal to generate SRE data:');
  console.log('\n1. Send a successful order:');
  console.log(`   curl -X POST http://localhost:${PORT}/checkout`);
  console.log('\n2. Send an order that fails at Stripe payment processing:');
  console.log(`   curl -X POST http://localhost:${PORT}/checkout?fail=stripe`);
  console.log('\n3. Send an order that fails at SMTP email notification:');
  console.log(`   curl -X POST http://localhost:${PORT}/checkout?fail=email`);
  console.log('\n4. Crash the application process (testing exit crash flushes):');
  console.log(`   curl http://localhost:${PORT}/crash`);
  console.log('\n========================================================================');
});
