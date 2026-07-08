const Redis = require('ioredis');

const API_URL = 'http://localhost:3001';
const REDIS_HOST = 'localhost';
const REDIS_PORT = 6379;

const testEmail = `test_main_${Date.now()}@queuewatch.dev`;
const testPassword = 'SecurePassword123!';
let jwtToken = '';
let projectId = '';
let apiKey = '';

const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT });

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
  console.log(`✓ Assertion Passed: ${message}`);
}

async function run() {
  console.log('========================================================================');
  console.log('🧪 Starting Main Branch E2E Test Suite');
  console.log('========================================================================');

  // 1. SRE User Registration
  console.log('\n[STAGE 1] Registering SRE Account...');
  const regRes = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Main Test Admin',
      email: testEmail,
      password: testPassword,
      company: 'TestCorp',
    }),
  });
  
  assert(regRes.ok, `Registration response status should be 201 (got ${regRes.status})`);
  const regData = await regRes.json();
  assert(regData.token, 'Registration should return a signed JWT token');
  jwtToken = regData.token;
  console.log(`SRE User registered with ID: ${regData.user?.id || 'Unknown'}`);

  // 2. Project Creation
  console.log('\n[STAGE 2] Creating SRE Project Workspace...');
  const projRes = await fetch(`${API_URL}/api/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwtToken}`,
    },
    body: JSON.stringify({ name: 'proj_test_main_workspace' }),
  });

  assert(projRes.ok, `Project creation status should be 201 (got ${projRes.status})`);
  const projData = await projRes.json();
  assert(projData.projectId, 'Project creation should return a projectId');
  assert(projData.apiKey, 'Project creation should return an apiKey');
  projectId = projData.projectId;
  apiKey = projData.apiKey;
  console.log(`Project workspace created. ID: ${projectId}, API Key: ${apiKey}`);

  // 3. SDK Connection Verification
  console.log('\n[STAGE 3] Verifying SDK Connection Handshake...');
  const verifyRes = await fetch(`${API_URL}/api/ingest/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ projectId }),
  });

  assert(verifyRes.ok, `Verification handshake should be 200/201 (got ${verifyRes.status})`);
  const verifyData = await verifyRes.json();
  assert(verifyData.projectName === 'proj_test_main_workspace', `Should return project name "proj_test_main_workspace" (got "${verifyData.projectName}")`);

  // 4. Telemetry Ingestion (Events, Logs, Heartbeats)
  console.log('\n[STAGE 4] Ingesting Telemetry Data (Events, Logs, Heartbeats)...');
  
  // 4a. Queue Event
  const eventTime = Date.now();
  const eventsRes = await fetch(`${API_URL}/api/ingest/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      projectId,
      events: [
        {
          type: 'job.failed',
          status: 'error',
          queueName: 'payment_queue',
          traceId: 'tr_test_main_999',
          errorMessage: 'Postgres query connection pool timeout after 10000ms',
          timestamp: eventTime,
        },
      ],
    }),
  });
  assert(eventsRes.ok, `Event ingestion status should be 200/201 (got ${eventsRes.status})`);

  // 4b. Console Log
  const logsRes = await fetch(`${API_URL}/api/ingest/logs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      projectId,
      level: 'error',
      message: 'SMTP 429 Rate Limit Exceeded on SendGrid gateway',
      queueName: 'email_notifications',
      traceId: 'tr_test_main_999',
      timestamp: eventTime,
    }),
  });
  assert(logsRes.ok, `Log ingestion status should be 200/201 (got ${logsRes.status})`);

  // 4c. Worker Heartbeat
  const heartbeatRes = await fetch(`${API_URL}/api/ingest/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      projectId,
      queueName: 'payment_queue',
      workerId: 'worker_payment_test_main_1',
      status: 'healthy',
      concurrency: 5,
      cpuUsage: 14,
      memoryUsage: 38,
      timestamp: eventTime,
    }),
  });
  assert(heartbeatRes.ok, `Heartbeat ingestion status should be 200/201 (got ${heartbeatRes.status})`);

  // 5. Direct Redis Storage Assertions
  console.log('\n[STAGE 5] Verifying Storage Formats directly in Redis...');
  
  // 5a. Telemetry list check
  const telemetryKey = `queuewatch:project:${projectId}:telemetry`;
  const rawEvents = await redis.lrange(telemetryKey, 0, -1);
  assert(rawEvents.length > 0, `Redis telemetry list key "${telemetryKey}" should contain items`);
  const parsedEvent = JSON.parse(rawEvents[0]);
  assert(parsedEvent.traceId === 'tr_test_main_999', 'Telemetry event should retain traceId value');

  // 5b. Logs list check
  const logsKey = `queuewatch:project:${projectId}:logs`;
  const rawLogs = await redis.lrange(logsKey, 0, -1);
  assert(rawLogs.length > 0, `Redis logs list key "${logsKey}" should contain items`);
  const parsedLog = JSON.parse(rawLogs[0]);
  assert(parsedLog.queueName === 'email_notifications', 'Log statement should retain queueName');

  // 5c. Worker hash check
  const workersKey = `queuewatch:project:${projectId}:workers`;
  const rawWorker = await redis.hget(workersKey, 'worker_payment_test_main_1');
  assert(rawWorker !== null, `Redis worker key "${workersKey}" should contain worker config`);
  const parsedWorker = JSON.parse(rawWorker);
  assert(parsedWorker.cpuUsage === 14, 'Worker should record correct CPU usage metadata');

  // 6. Reliability Scoring & Recalculation
  console.log('\n[STAGE 6] Recalculating Queue & Service Reliability Scores...');
  
  // Delete score cache to force NestJS to run recalculation dynamically
  await redis.del(`queuewatch:project:${projectId}:reliability_scores`);

  const scoreRes = await fetch(`${API_URL}/api/reliability`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      'x-project-id': projectId,
    },
  });
  assert(scoreRes.ok, `Reliability score query should be 200 (got ${scoreRes.status})`);

  // Assert score values saved in Redis hash
  const scoresKey = `queuewatch:project:${projectId}:reliability_scores`;
  const rawScores = await redis.hvals(scoresKey);
  assert(rawScores.length > 0, `Redis score hash "${scoresKey}" should contain calculated values`);
  console.log(`Scores recalculation verified. Total scores stored: ${rawScores.length}`);

  // 7. SRE Copilot Fallback Verification
  console.log('\n[STAGE 7] Verifying SRE Copilot fallback dialog response...');
  const copilotRes = await fetch(`${API_URL}/api/copilot/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwtToken}`,
      'x-project-id': projectId,
    },
    body: JSON.stringify({
      prompt: 'Why is email_notifications queue failing?',
    }),
  });

  assert(copilotRes.ok, `Copilot query should be 200/201 (got ${copilotRes.status})`);
  const copilotData = await copilotRes.json();
  assert(copilotData.answer, 'Copilot response should contain "answer" text');
  assert(Array.isArray(copilotData.evidence), 'Copilot response should return evidence array');
  assert(Array.isArray(copilotData.recommendedActions), 'Copilot response should return actions array');
  console.log('\nCopilot Response Sample Answer:');
  console.log(copilotData.answer);

  // 8. Redis Cleanup
  console.log('\n[STAGE 8] Cleaning up workspace test keys from Redis...');
  const keys = await redis.keys(`queuewatch:*${projectId}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  await redis.del(`queuewatch:users:${testEmail}`);
  console.log(`Purged ${keys.length} project workspace keys and SRE user credentials.`);

  console.log('\n========================================================================');
  console.log('🎉 SUCCESS: All Main Branch verification tests passed successfully!');
  console.log('========================================================================');
  
  redis.disconnect();
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ E2E Execution Failed with exception:', err);
  redis.disconnect();
  process.exit(1);
});
