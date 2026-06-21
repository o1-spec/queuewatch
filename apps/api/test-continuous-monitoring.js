/**
 * Phase 3.3 — Continuous Reliability Monitoring Agent E2E Test
 *
 * Verifies:
 *   1. Proactive Risk Detection (Worker Saturation, Deployment, DLQ Growth).
 *   2. Timeframe-based Reliability Forecasting (Incident Probabilities, Score Trajectories, Blast Radius Cascades).
 *   3. Socratic Copilot Integration responses.
 */

const http = require('http');
const assert = require('assert');
const Redis = require('ioredis');

const API = 'http://localhost:3001';
const PROJECT_ID = 'proj_monitoring_test';
let TOKEN = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function request(method, path, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
        'x-project-id': PROJECT_ID,
        ...extraHeaders,
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function log(msg) { process.stdout.write(`${msg}\n`); }
function pass(msg) { log(`✓ ${msg}`); }
function fail(msg) { log(`✗ ${msg}`); process.exit(1); }
function section(msg) { log(`\n${msg}`); }

const SCOPE = `queuewatch:project:${PROJECT_ID}`;

// ─── Main Test ────────────────────────────────────────────────────────────────

async function main() {
  log('\n╔══════════════════════════════════════════════════════════════════╗');
  log('║   Phase 3.3 — Continuous Reliability Monitoring Agent E2E        ║');
  log('╚══════════════════════════════════════════════════════════════════╝\n');

  // ─── 0. Login ──────────────────────────────────────────────────────────────
  section('0. Authenticating as demo user...');
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'demo@queuewatch.dev',
    password: 'password123',
  }, {});
  if (loginRes.status !== 200 && loginRes.status !== 201) {
    fail(`Auth failed: ${JSON.stringify(loginRes.body)}`);
  }
  TOKEN = loginRes.body.token || loginRes.body.access_token;
  pass('Authenticated successfully.');

  // ─── 1. Seed Degraded Metrics & Topologies ─────────────────────────────────
  section('1. Seeding project metadata, service topologies, and metric anomalies...');
  const redisClient = new Redis('redis://localhost:6379');

  // Clear any existing keys first to avoid WRONGTYPE redis errors from previous runs
  await redisClient.del(
    `queuewatch:project_metadata:${PROJECT_ID}`,
    `${SCOPE}:queues`,
    `${SCOPE}:workers`,
    `${SCOPE}:deployments`,
    `${SCOPE}:telemetry`,
    `${SCOPE}:queues:metrics`,
    `${SCOPE}:dead_letter_jobs`,
    `${SCOPE}:reliability_scores`,
    `${SCOPE}:dependency_graph`,
    `${SCOPE}:services`,
    `${SCOPE}:predictions`,
    `${SCOPE}:forecasts`
  );

  await redisClient.set(
    `queuewatch:project_metadata:${PROJECT_ID}`,
    JSON.stringify({ id: PROJECT_ID, name: 'Monitoring E2E Project', apiKey: 'qw_monitoring_test', createdAt: Date.now(), hasReceivedTelemetry: true })
  );
  
  const meRes = await request('GET', '/api/auth/me');
  const userId = meRes.body?.username || meRes.body?.id || meRes.body?.sub || 'demo_user_sre_910';
  await redisClient.sadd(`queuewatch:user_projects:${userId}`, PROJECT_ID);
  
  await redisClient.sadd(`${SCOPE}:queues`, 'payment_queue');

  // A. Seed Worker with status "overloaded" to trigger Worker Saturation Risk
  const mockWorker = {
    workerId: 'wrk_payment_1',
    queueName: 'payment_queue',
    status: 'overloaded',
    cpuUsage: 92,
    memoryUsage: 80,
    lastActive: Date.now()
  };
  await redisClient.hset(`${SCOPE}:workers`, mockWorker.workerId, JSON.stringify(mockWorker));

  // B. Seed recent deployment (released 10 minutes ago) to trigger Deployment Risk
  const depTime = Date.now() - 10 * 60 * 1000;
  const depEvent = {
    id: 'dep_monitoring_123',
    service: 'payment_queue',
    version: 'v2.2.0',
    commitSha: 'commit220220220',
    branch: 'release/v2.2.0',
    environment: 'production',
    deployedBy: 'SRE Coordinator',
    deployedAt: depTime,
  };
  await redisClient.lpush(`${SCOPE}:deployments`, JSON.stringify(depEvent));

  // C. Seed high-latency telemetry post-deployment
  const mockTelemetry = [
    { queueName: 'payment_queue', jobId: 'job_lat_1', type: 'job.active', duration: 1800, latency: 1800, timestamp: Date.now() - 60000 },
    { queueName: 'payment_queue', jobId: 'job_lat_2', type: 'job.completed', duration: 1900, latency: 1900, timestamp: Date.now() - 30000 }
  ];
  await redisClient.set(`${SCOPE}:queues:metrics`, JSON.stringify([
    { queueName: 'payment_queue', waitingCount: 15, activeCount: 5, completedCount: 100, failedCount: 5, delayedCount: 0, paused: false, throughput: 12.5, averageLatency: 1850, timestamp: Date.now() }
  ]));
  for (const t of mockTelemetry) {
    await redisClient.lpush(`${SCOPE}:telemetry`, JSON.stringify(t));
  }

  // D. Seed dead letter jobs to trigger DLQ Growth Risk
  const mockDeadLetterJob = {
    id: 'dlq_job_99',
    queueName: 'payment_queue',
    jobId: 'job_crash_99',
    jobName: 'stripe.charge',
    failedAt: Date.now() - 5 * 60 * 1000,
    errorClass: 'StripeConnectionError',
    errorMessage: 'Connection failed to stripe api',
    stacktrace: ['StripeConnectionError: Connection failed', 'at StripeService.charge'],
    payload: { amount: 10000, currency: 'USD' }
  };
  await redisClient.hset(`${SCOPE}:dead_letter_jobs`, mockDeadLetterJob.id, JSON.stringify(mockDeadLetterJob));

  // E. Seed reliability score baseline (80%)
  const reliabilityScore = {
    id: `score_payment_queue_${Date.now()}`,
    targetId: 'payment_queue',
    targetType: 'queue',
    score: 80,
    failureRate: 10,
    retryRate: 0,
    backlogGrowth: 0,
    workerHealthScore: 100,
    incidentFrequency: 0,
    timestamp: Date.now(),
    contributors: {
      failureRate: -5,
      latency: -10,
      workerHealth: 0,
      incidents: 0,
      blastRadius: -5,
      deployments: 0
    }
  };
  await redisClient.hset(`${SCOPE}:reliability_scores`, `queue:payment_queue`, JSON.stringify(reliabilityScore));

  // F. Seed Dependency Graph
  const dependencyGraph = {
    nodes: [
      { id: 'payment_queue', label: 'payment_queue', type: 'queue' },
      { id: 'email_notifications', label: 'email_notifications', type: 'queue' },
      { id: 'svc_notifications', label: 'notification-service', type: 'service' }
    ],
    edges: [
      { from: 'payment_queue', to: 'email_notifications' },
      { from: 'email_notifications', to: 'svc_notifications' }
    ]
  };
  await redisClient.set(`${SCOPE}:dependency_graph`, JSON.stringify(dependencyGraph));

  // G. Seed Service mapping
  const serviceObj = {
    id: 'svc_payment',
    name: 'payment-service',
    environment: 'production',
    owner: 'Payment SRE',
    status: 'healthy',
    createdAt: Date.now(),
    queues: ['payment_queue'],
    workers: ['wrk_payment_1'],
    deployments: ['dep_monitoring_123'],
    incidents: []
  };
  await redisClient.hset(`${SCOPE}:services`, 'svc_payment', JSON.stringify(serviceObj));

  await redisClient.quit();
  pass('Degraded state successfully seeded in Redis.');

  // ─── 2. Trigger Diagnostics ────────────────────────────────────────────────
  section('2. Triggering Continuous Risk Analysis Loop (POST /api/predictions/analyze)...');
  const analyzeRes = await request('POST', '/api/predictions/analyze');
  assert(analyzeRes.status === 200 || analyzeRes.status === 201, `Failed to execute analyze: ${analyzeRes.status}`);
  pass('Analysis loop executed successfully.');

  // ─── 3. Verify Predictions ──────────────────────────────────────────────────
  section('3. Querying Emerging Risks (GET /api/predictions)...');
  const predictionsRes = await request('GET', '/api/predictions');
  assert(predictionsRes.status === 200, `Failed: ${predictionsRes.status}`);
  const predictions = predictionsRes.body;

  assert(Array.isArray(predictions), 'Predictions must be an array');
  assert(predictions.length >= 3, `Expected at least 3 risks detected, got ${predictions.length}`);

  const titles = predictions.map(p => p.title);
  const confidences = predictions.reduce((acc, curr) => {
    acc[curr.id] = curr.confidenceScore;
    return acc;
  }, {});
  const reasons = predictions.reduce((acc, curr) => {
    acc[curr.id] = curr.reason;
    return acc;
  }, {});

  log('Detected Predictions:');
  predictions.forEach(p => log(`  - [Conf: ${p.confidenceScore}%] [Risk: ${p.riskScore}%] ${p.title} | Reason: "${p.reason}"`));

  // Validate Worker Saturation Risk
  const wSat = predictions.find(p => p.id === 'pred_worker_saturation_payment_queue');
  assert(wSat, 'Worker Saturation Risk missing');
  assert(wSat.confidenceScore === 88, `Worker Saturation expected 88% confidence, got ${wSat.confidenceScore}`);
  assert(wSat.reason === 'Worker utilization increasing steadily.', `Worker Saturation expected reason, got "${wSat.reason}"`);

  // Validate Deployment Risk
  const depRisk = predictions.find(p => p.id === 'pred_deployment_risk_payment_queue');
  assert(depRisk, 'Deployment Risk missing');
  assert(depRisk.confidenceScore === 92, `Deployment Risk expected 92% confidence, got ${depRisk.confidenceScore}`);
  assert(depRisk.reason === 'Recent deployment correlates with increasing latency.', `Deployment Risk expected reason, got "${depRisk.reason}"`);

  // Validate DLQ Growth Risk
  const dlqRisk = predictions.find(p => p.id === 'pred_dlq_growth_payment_queue');
  assert(dlqRisk, 'DLQ Growth Risk missing');
  assert(dlqRisk.confidenceScore === 95, `DLQ Growth Risk expected 95% confidence, got ${dlqRisk.confidenceScore}`);
  assert(dlqRisk.reason === 'Dead-letter jobs increasing for 20 minutes.', `DLQ Growth Risk expected reason, got "${dlqRisk.reason}"`);

  pass('All 3 proactive risks successfully identified with correct SRE metadata.');

  // ─── 4. Verify Forecasts ────────────────────────────────────────────────────
  section('4. Querying Reliability Forecasts (GET /api/predictions/forecast)...');
  const forecastRes = await request('GET', '/api/predictions/forecast');
  assert(forecastRes.status === 200, `Failed: ${forecastRes.status}`);
  const forecasts = forecastRes.body;

  assert(Array.isArray(forecasts), 'Forecasts must be an array');
  const pQueueForecast = forecasts.find(f => f.targetId === 'payment_queue');
  assert(pQueueForecast, 'payment_queue forecast missing');

  log('Forecasting Intervals:');
  pQueueForecast.forecasts.forEach(tf => {
    log(`  [Timeframe: ${tf.timeframe}]`);
    log(`    Incident Probability: ${tf.incidentProbability}%`);
    log(`    Score Trajectory Projection: [${tf.reliabilityScoreTrajectory.join(' ➔ ')}]%`);
    log(`    BFS Blast Radius Cascade: [${tf.blastRadiusPotential.join(', ')}]`);
    
    assert(typeof tf.incidentProbability === 'number', 'Probability must be a number');
    assert(tf.reliabilityScoreTrajectory.length === 3, 'Score trajectory should contain 3 projected steps');
    
    // Trajectory must project a degradation (descending scores)
    const traj = tf.reliabilityScoreTrajectory;
    assert(traj[0] >= traj[1] && traj[1] >= traj[2], `Trajectory scores must be descending: [${traj.join(', ')}]`);
  });

  // Verify Incident Probability escalation
  const prob1h = pQueueForecast.forecasts.find(f => f.timeframe === '1h').incidentProbability;
  const prob6h = pQueueForecast.forecasts.find(f => f.timeframe === '6h').incidentProbability;
  const prob24h = pQueueForecast.forecasts.find(f => f.timeframe === '24h').incidentProbability;
  assert(prob6h >= prob1h, 'Incident probability should scale upwards or remain capped');
  assert(prob24h >= prob6h, 'Incident probability should scale upwards or remain capped');

  // Verify BFS Blast Radius downstream paths
  const blast1h = pQueueForecast.forecasts.find(f => f.timeframe === '1h').blastRadiusPotential;
  assert(blast1h.includes('email_notifications'), 'Blast radius should cascade to email_notifications');
  assert(blast1h.includes('svc_notifications') || blast1h.includes('notification-service'), 'Blast radius should cascade to notification service');

  pass('Reliability Forecasting metrics and BFS blast cascade verified successfully.');

  // ─── 5. Verify Copilot Integration ──────────────────────────────────────────
  section('5. Querying Socratic SRE Copilot with Proactive Prompts...');

  const copRes1 = await request('POST', '/api/copilot/query', { prompt: 'What is likely to fail next?' });
  assert(copRes1.status === 200 || copRes1.status === 201, `Failed: ${copRes1.status}`);
  log('Copilot Answer (Question: "What is likely to fail next?"):');
  log(`  ${copRes1.body.answer.split('\n')[0]}`);
  assert(copRes1.body.answer.includes('payment_queue'), 'Response should mention payment_queue');
  assert(copRes1.body.answer.includes('Worker Saturation Risk'), 'Response should identify the active prediction risk');
  assert(copRes1.body.recommendedActions.length > 0, 'Should return proactive mitigation actions');
  pass('Copilot query for trending failure next passed.');

  const copRes2 = await request('POST', '/api/copilot/query', { prompt: 'Which service is becoming unhealthy?' });
  assert(copRes2.status === 200 || copRes2.status === 201, `Failed: ${copRes2.status}`);
  log('Copilot Answer (Question: "Which service is becoming unhealthy?"):');
  log(`  ${copRes2.body.answer.split('\n')[0]}`);
  assert(copRes2.body.answer.includes('payment_queue'), 'Response should mention payment_queue');
  assert(copRes2.body.answer.includes('Reliability Score Trajectory'), 'Response should list score trajectories');
  pass('Copilot query for unhealthy service tracking passed.');

  const copRes3 = await request('POST', '/api/copilot/query', { prompt: 'What deployment should I watch?' });
  assert(copRes3.status === 200 || copRes3.status === 201, `Failed: ${copRes3.status}`);
  log('Copilot Answer (Question: "What deployment should I watch?"):');
  log(`  ${copRes3.body.answer.split('\n')[0]}`);
  assert(copRes3.body.answer.includes('payment_queue') || copRes3.body.answer.includes('payment-service'), 'Response should mention the deployed service');
  assert(copRes3.body.answer.includes('v2.2.0'), 'Response should mention version v2.2.0');
  assert(copRes3.body.recommendedActions.some(a => a.type === 'investigate_deployment'), 'Should suggest rollback deployment mitigation');
  pass('Copilot query for deployment watchlist passed.');

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  section('6. Cleaning up test keys...');
  const cleanupRedis = new Redis('redis://localhost:6379');
  await cleanupRedis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await cleanupRedis.srem(`queuewatch:user_projects:${userId}`, PROJECT_ID);
  await cleanupRedis.del(`${SCOPE}:queues`);
  await cleanupRedis.del(`${SCOPE}:workers`);
  await cleanupRedis.del(`${SCOPE}:deployments`);
  await cleanupRedis.del(`${SCOPE}:telemetry`);
  await cleanupRedis.del(`${SCOPE}:queues:metrics`);
  await cleanupRedis.del(`${SCOPE}:dead_letter_jobs`);
  await cleanupRedis.del(`${SCOPE}:reliability_scores`);
  await cleanupRedis.del(`${SCOPE}:dependency_graph`);
  await cleanupRedis.del(`${SCOPE}:services`);
  await cleanupRedis.del(`${SCOPE}:predictions`);
  await cleanupRedis.del(`${SCOPE}:forecasts`);
  await cleanupRedis.del(`${SCOPE}:copilot_logs`);
  await cleanupRedis.quit();
  pass('Cleanup complete.');

  log('\n╔══════════════════════════════════════════════════════════════════╗');
  log('║  ✅  Phase 3.3 Continuous Reliability Monitoring E2E passed      ║');
  log('╚══════════════════════════════════════════════════════════════════╝\n');
}

main().catch((err) => {
  console.error('\n❌ E2E test failed with error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
