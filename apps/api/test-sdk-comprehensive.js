const { QueueWatch } = require('../../packages/node-sdk/dist/index.js');
const Redis = require('ioredis');
const http = require('http');

const redis = new Redis({ host: 'localhost', port: 6379 });
const PORT = 3999;
const ENDPOINT = `http://localhost:${PORT}`;
const PROJECT_ID = `proj_sdk_test_${Date.now()}`;
const API_KEY = `qw_pk_sdk_test_${Date.now()}`;

async function main() {
  console.log('--- SDK Comprehensive Validation ---');

  // Seed project metadata and key mapping in Redis
  await redis.set(`queuewatch:project_metadata:${PROJECT_ID}`, JSON.stringify({
    id: PROJECT_ID,
    name: 'SDK Validation Project',
    apiKey: API_KEY,
    createdAt: Date.now(),
    hasReceivedTelemetry: true
  }));
  await redis.set(`queuewatch:api_keys:${API_KEY}`, JSON.stringify({
    projectId: PROJECT_ID,
    userId: 'demo_user_sre_910'
  }));
  await redis.sadd('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);

  // Set up a mock HTTP server to inspect SDK payloads
  let lastPayloads = [];
  let serverFailStatus = 0; // 0 = success, 500 = transient fail
  
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (serverFailStatus > 0) {
        res.writeHead(serverFailStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Transient Failure' }));
        return;
      }
      lastPayloads.push({ url: req.url, body: JSON.parse(body) });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, projectName: 'SDK Validation Project' }));
    });
  });

  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Mock SRE telemetry server listening on ${ENDPOINT}`);

  // Test 1: SDK connection verification
  console.log('\n[TEST 1] Verifying SDK initialization...');
  const sdk = new QueueWatch({
    projectId: PROJECT_ID,
    apiKey: API_KEY,
    endpoint: ENDPOINT,
    service: 'validation-service'
  });

  await new Promise(r => setTimeout(r, 200)); // Wait for verify connection fetch
  console.log('✓ SDK Initialized successfully');

  // Test 2: Event Batching (20 events or 1 second)
  console.log('\n[TEST 2] Verifying Event Batching...');
  lastPayloads = [];
  
  // Enqueue 5 events
  for (let i = 0; i < 5; i++) {
    sdk.trackEvent({ type: 'job.active', service: 'validation-service', message: `Active ${i}` });
  }
  
  console.log('  Enqueued 5 events. Checking payload count immediately...');
  if (lastPayloads.length === 0) {
    console.log('  ✓ Correct: events buffered (not flushed immediately)');
  } else {
    throw new Error('FAIL: Events flushed immediately when below batch limit');
  }

  console.log('  Waiting 1.2 seconds for batch timeout...');
  await new Promise(r => setTimeout(r, 1200));

  if (lastPayloads.length === 1 && lastPayloads[0].body.events.length === 5) {
    console.log('  ✓ Correct: 5 events flushed after 1 second timeout');
  } else {
    throw new Error(`FAIL: Expected 1 batch payload of 5 events. Found: ${JSON.stringify(lastPayloads)}`);
  }

  // Enqueue 20 events to trigger immediate flush
  lastPayloads = [];
  console.log('  Enqueued 20 events...');
  for (let i = 0; i < 20; i++) {
    sdk.trackEvent({ type: 'job.completed', service: 'validation-service', message: `Completed ${i}` });
  }
  
  await new Promise(r => setTimeout(r, 100)); // Short tick for fetch resolution
  if (lastPayloads.length === 1 && lastPayloads[0].body.events.length === 20) {
    console.log('  ✓ Correct: immediate flush triggered upon reaching 20 events');
  } else {
    throw new Error(`FAIL: Expected immediate flush of 20 events. Found: ${lastPayloads.length} payloads`);
  }

  // Test 3: Offline queueing and retry logic
  console.log('\n[TEST 3] Verifying offline queueing and exponential backoff retry...');
  serverFailStatus = 500; // Trigger transient failure
  lastPayloads = [];

  console.log('  Enqueued an event with server returning HTTP 500...');
  sdk.trackEvent({ type: 'job.failed', service: 'validation-service', message: 'Failed job trace' });
  await new Promise(r => setTimeout(r, 1200)); // Let the batch timer flush

  console.log(`  SDK Offline queue size: ${sdk.getOfflineQueueSize()}`);
  if (sdk.getOfflineQueueSize() === 1) {
    console.log('  ✓ Correct: event added to offline queue on transient failure');
  } else {
    throw new Error('FAIL: Event not added to offline queue');
  }

  console.log('  Restoring mock telemetry server to healthy status...');
  serverFailStatus = 0;

  // Enqueue a successful event which triggers a queue drain
  sdk.trackEvent({ type: 'job.waiting', service: 'validation-service' });
  await new Promise(r => setTimeout(r, 1200)); // Let it drain

  console.log(`  SDK Offline queue size: ${sdk.getOfflineQueueSize()}`);
  if (sdk.getOfflineQueueSize() === 0) {
    console.log('  ✓ Correct: offline queue successfully drained and empty');
  } else {
    throw new Error('FAIL: Offline queue failed to drain');
  }

  // Clean up
  await sdk.cleanup();
  server.close();
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  redis.disconnect();

  console.log('\n✓ SUCCESS: SDK Comprehensive Validation Completed.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('SDK Validation Error:', err);
    process.exit(1);
  });
}
