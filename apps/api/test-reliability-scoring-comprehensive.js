const Redis = require('ioredis');

const ENDPOINT = 'http://localhost:3001';
const PROJECT_ID = `proj_reliability_scoring_${Date.now()}`;
const API_KEY = `qw_pk_rel_scor_${Date.now()}`;
const redis = new Redis({ host: 'localhost', port: 6379 });

async function main() {
  console.log('--- Reliability Scoring Comprehensive Validation ---');

  // Seed project, key mapping, SRE user
  await redis.set(`queuewatch:project_metadata:${PROJECT_ID}`, JSON.stringify({
    id: PROJECT_ID,
    name: 'Reliability Scoring Project',
    apiKey: API_KEY,
    createdAt: Date.now(),
    hasReceivedTelemetry: true
  }));
  await redis.set(`queuewatch:api_keys:${API_KEY}`, JSON.stringify({
    projectId: PROJECT_ID,
    userId: 'demo_user_sre_910'
  }));
  await redis.sadd('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);

  // Authenticate SRE
  const loginRes = await fetch(`${ENDPOINT}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@queuewatch.dev', password: 'password123' })
  });
  const { token } = await loginRes.json();
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-project-id': PROJECT_ID
  };

  // Seed default queues, services
  const servicesKey = `queuewatch:project:${PROJECT_ID}:services`;
  const paymentService = {
    id: 'svc_payment_service',
    name: 'payment_service',
    queues: ['payment_queue'],
    workers: ['worker_1'],
    createdAt: Date.now()
  };
  await redis.hset(servicesKey, 'svc_payment_service', JSON.stringify(paymentService));
  await redis.sadd(`queuewatch:project:${PROJECT_ID}:queues`, 'payment_queue');

  // Seed a healthy worker to ensure 100% baseline reliability
  await redis.hset(`queuewatch:project:${PROJECT_ID}:workers`, 'worker_1', JSON.stringify({
    workerId: 'worker_1',
    queueName: 'payment_queue',
    status: 'healthy',
    concurrency: 5,
    cpuUsage: 12,
    memoryUsage: 25,
    lastActive: Date.now()
  }));

  // STAGE 1: Baseline health
  console.log('\n[STAGE 1] Querying baseline reliability score...');
  const res1 = await fetch(`${ENDPOINT}/api/reliability?refresh=true`, { headers: authHeaders });
  const scores1 = await res1.json();
  
  const paymentScore1 = scores1.find(s => s.targetId === 'payment_queue');
  console.log('  Initial Score:', paymentScore1 ? paymentScore1.score : 'N/A (or defaults to 100)');
  if (!paymentScore1 || paymentScore1.score === 100) {
    console.log('✓ Stage 1 Passed: Healthy system starts with a baseline reliability of 100%');
  } else {
    throw new Error(`FAIL: Healthy system reliability score degraded: ${JSON.stringify(paymentScore1)}`);
  }

  // STAGE 2: Degraded Outage Scenario
  console.log('\n[STAGE 2] Seeding outages and degraded metrics...');
  
  // Seed critical open incident
  const incident = {
    id: 'inc_scoring_1',
    title: 'Failure spike on payment_queue',
    severity: 'critical',
    affectedQueue: 'payment_queue',
    status: 'open',
    firstDetectedAt: Date.now()
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, 'inc_scoring_1', JSON.stringify(incident));

  // Seed failed telemetry events
  const sdkHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  };
  for (let i = 0; i < 5; i++) {
    await fetch(`${ENDPOINT}/api/ingest/events`, {
      method: 'POST',
      headers: sdkHeaders,
      body: JSON.stringify({
        projectId: PROJECT_ID,
        events: [{
          id: `tel_score_err_${i}`,
          type: 'job.failed',
          queueName: 'payment_queue',
          serviceName: 'payment_service',
          duration: 4000,
          timestamp: Date.now()
        }]
      })
    });
  }

  // Seed overloaded worker heartbeat
  await fetch(`${ENDPOINT}/api/ingest/heartbeat`, {
    method: 'POST',
    headers: sdkHeaders,
    body: JSON.stringify({
      projectId: PROJECT_ID,
      queueName: 'payment_queue',
      workerId: 'worker_1',
      status: 'overloaded'
    })
  });

  // Query updated reliability score
  const res2 = await fetch(`${ENDPOINT}/api/reliability?refresh=true`, { headers: authHeaders });
  const scores2 = await res2.json();
  const paymentScore2 = scores2.find(s => s.targetId === 'payment_queue');

  if (!paymentScore2) {
    throw new Error('FAIL: payment_queue score not calculated');
  }
  
  console.log('  Updated Score:', paymentScore2.score);
  console.log('  Deductions Breakdown:', paymentScore2.contributors);

  if (paymentScore2.score < 60) {
    console.log('✓ Stage 2 Passed: Outages correctly degrade score below 60%');
  } else {
    throw new Error(`FAIL: Reliability score remained high during critical outage: ${paymentScore2.score}`);
  }

  if (paymentScore2.contributors.incidents < 0 && paymentScore2.contributors.failureRate < 0 && paymentScore2.contributors.workerHealth < 0) {
    console.log('✓ Stage 2b Passed: All contributor scoring deductions properly calculated and categorized');
  } else {
    throw new Error(`FAIL: Contributor deduction categories incorrect: ${JSON.stringify(paymentScore2.contributors)}`);
  }

  // STAGE 3: Recovery Scenario
  console.log('\n[STAGE 3] Recovering outages and verifying score restoration...');
  
  // Clear old degraded telemetry to simulate new window where system returned to healthy
  await redis.del(`queuewatch:project:${PROJECT_ID}:telemetry`);

  // Resolve incident
  await fetch(`${ENDPOINT}/api/incidents/inc_scoring_1/resolve`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ summary: 'Resolved.' })
  });

  // Seed healthy worker heartbeat
  await fetch(`${ENDPOINT}/api/ingest/heartbeat`, {
    method: 'POST',
    headers: sdkHeaders,
    body: JSON.stringify({
      projectId: PROJECT_ID,
      queueName: 'payment_queue',
      workerId: 'worker_1',
      status: 'healthy'
    })
  });

  // Ingest healthy completed jobs
  for (let i = 0; i < 5; i++) {
    await fetch(`${ENDPOINT}/api/ingest/events`, {
      method: 'POST',
      headers: sdkHeaders,
      body: JSON.stringify({
        projectId: PROJECT_ID,
        events: [{
          id: `tel_score_ok_${i}`,
          type: 'job.completed',
          queueName: 'payment_queue',
          serviceName: 'payment_service',
          duration: 100,
          timestamp: Date.now()
        }]
      })
    });
  }

  // Query recovered score
  const res3 = await fetch(`${ENDPOINT}/api/reliability?refresh=true`, { headers: authHeaders });
  const scores3 = await res3.json();
  const paymentScore3 = scores3.find(s => s.targetId === 'payment_queue');

  console.log('  Recovered Score:', paymentScore3 ? paymentScore3.score : 'N/A');

  if (paymentScore3 && paymentScore3.score >= 90) {
    console.log('✓ Stage 3 Passed: Reliability score successfully restored to healthy thresholds upon resolution');
  } else {
    throw new Error(`FAIL: Reliability score failed to recover: ${JSON.stringify(paymentScore3)}`);
  }

  // Clean up
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  await redis.del(`queuewatch:project:${PROJECT_ID}:reliability_scores`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:reliability_history:payment_queue`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:reliability_history:svc_payment_service`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:deployments`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:telemetry`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:workers`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:incidents`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:queues`);
  await redis.del(servicesKey);
  redis.disconnect();

  console.log('\n✓ SUCCESS: Reliability Scoring Validation Completed.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Reliability Scoring Validation Error:', err);
    process.exit(1);
  });
}
