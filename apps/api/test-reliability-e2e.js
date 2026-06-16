const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

const PROJECT_ID = 'proj_test_reliability';
const API_KEY = 'qw_test_key_reliability';
const INCIDENT_ID = 'inc_test_reliability';
const ENDPOINT = 'http://localhost:3001';

async function main() {
  console.log('1. Seeding project, API key, and user in Redis...');

  // Seed project metadata
  await redis.set(
    `queuewatch:project_metadata:${PROJECT_ID}`,
    JSON.stringify({
      id: PROJECT_ID,
      name: 'E2E Reliability Test Project',
      apiKey: API_KEY,
      createdAt: Date.now(),
      hasReceivedTelemetry: true,
    })
  );

  // Link project to admin/demo user
  await redis.sadd('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);

  // Seed API key mapping
  await redis.set(
    `queuewatch:api_keys:${API_KEY}`,
    JSON.stringify({ projectId: PROJECT_ID, userId: 'demo_user_sre_910' })
  );

  // Seed Service Metadata (businessCapability, description, etc.)
  const servicesKey = `queuewatch:project:${PROJECT_ID}:services`;
  const testService = {
    id: 'svc_payment_service',
    name: 'payment-service',
    description: 'Stripe payments.',
    environment: 'production',
    owner: 'finance-team',
    status: 'degraded',
    createdAt: Date.now(),
    queues: ['webhook_delivery'],
    workers: ['webhook_delivery'],
    deployments: [],
    incidents: [INCIDENT_ID],
    businessCapability: 'Customer Payments'
  };
  await redis.hset(servicesKey, testService.id, JSON.stringify(testService));

  // Seed Dependency Graph
  const dgKey = `queuewatch:project:${PROJECT_ID}:dependency_graph`;
  const defaultGraph = {
    nodes: [
      { id: 'svc_payment_service', label: 'Payment Service', type: 'service' },
      { id: 'webhook_delivery', label: 'webhook_delivery', type: 'queue' },
      { id: 'svc_invoice_service', label: 'Invoice Service', type: 'service' }
    ],
    edges: [
      { from: 'webhook_delivery', to: 'svc_payment_service', observations: 120 },
      { from: 'svc_payment_service', to: 'svc_invoice_service', observations: 95 }
    ],
    serviceImpacts: {}
  };
  await redis.set(dgKey, JSON.stringify(defaultGraph));

  // Seed open incident (critical severity on webhook_delivery)
  const incidentTime = Date.now();
  const incidentObj = {
    id: INCIDENT_ID,
    title: 'High Failure Rate on webhook_delivery',
    severity: 'critical',
    affectedQueue: 'webhook_delivery',
    status: 'open',
    firstDetectedAt: incidentTime,
    lastUpdatedAt: incidentTime,
    summary: 'Webhook queue failed.',
    evidence: 'Telemetry check.',
    suspectedRootCause: 'None.',
    recommendation: 'Fix it.',
    impact: 'Degraded.',
    relatedErrors: [],
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, INCIDENT_ID, JSON.stringify(incidentObj));

  // Seed correlated regression deployment (deployed 5 mins before incident)
  const depTime = incidentTime - 5 * 60 * 1000;
  const depEvent = {
    id: 'dep_test_reliability_123',
    service: 'webhook_delivery',
    version: 'v1.5.0',
    commitSha: 'commit999',
    branch: 'main',
    environment: 'production',
    deployedBy: 'SRE Operator',
    deployedAt: depTime,
  };
  await redis.lpush(`queuewatch:project:${PROJECT_ID}:deployments`, JSON.stringify(depEvent));

  // Ingest telemetry events to generate bad scores
  // Ingest 10 events: 4 completed, 6 failed (60% failure rate)
  // email_notifications target is 1000ms. Let's record 3000ms latency to cause latency deduction.
  const sdkHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  console.log('2. Ingesting high error rates and high latencies...');
  // 6 Failed Jobs
  for (let i = 0; i < 6; i++) {
    await fetch(`${ENDPOINT}/api/ingest/events`, {
      method: 'POST',
      headers: sdkHeaders,
      body: JSON.stringify({
        projectId: PROJECT_ID,
        events: [{
          id: `tel_err_${i}`,
          type: 'job.failed',
          queueName: 'webhook_delivery',
          serviceName: 'payment-service',
          duration: 3000,
          timestamp: Date.now(),
        }]
      })
    });
  }
  // 4 Completed Jobs
  for (let i = 0; i < 4; i++) {
    await fetch(`${ENDPOINT}/api/ingest/events`, {
      method: 'POST',
      headers: sdkHeaders,
      body: JSON.stringify({
        projectId: PROJECT_ID,
        events: [{
          id: `tel_ok_${i}`,
          type: 'job.completed',
          queueName: 'webhook_delivery',
          serviceName: 'payment-service',
          duration: 3000,
          timestamp: Date.now(),
        }]
      })
    });
  }

  // Record worker down heartbeat
  await fetch(`${ENDPOINT}/api/ingest/heartbeat`, {
    method: 'POST',
    headers: sdkHeaders,
    body: JSON.stringify({
      projectId: PROJECT_ID,
      queueName: 'webhook_delivery',
      serviceName: 'payment-service',
      workerId: 'worker_webhook_1',
      status: 'down',
    })
  });

  console.log('3. Logging in to acquire SRE JWT token...');
  const loginRes = await fetch(`${ENDPOINT}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'demo@queuewatch.dev',
      password: 'password123',
    }),
  });
  if (!loginRes.ok) throw new Error('Login failed');
  const { token } = await loginRes.json();
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-project-id': PROJECT_ID,
  };

  console.log('4. Requesting recalculated reliability scores...');
  const res = await fetch(`${ENDPOINT}/api/reliability`, {
    headers: authHeaders,
  });
  if (!res.ok) throw new Error(`Fetch scores failed: ${res.status}`);
  const scores = await res.json();

  console.log('\n--- Calculated SRE Reliability Scores ---');
  console.log(JSON.stringify(scores, null, 2));

  // Assertions
  const webhookScore = scores.find(s => s.targetId === 'webhook_delivery' && s.targetType === 'queue');
  if (!webhookScore) {
    console.error('FAIL: webhook_delivery queue score not found!');
  } else {
    console.log('\n--- Verifying Queue Reliability Score ---');
    console.log('Overall Score:', webhookScore.score);
    console.log('Failure Rate:', webhookScore.failureRate);
    console.log('Worker Health Score:', webhookScore.workerHealthScore);
    console.log('Explainable Contributors:', webhookScore.contributors);

    if (webhookScore.score < 50) {
      console.log('✓ SUCCESS: Score correctly degraded below 50 due to multiple outages.');
    } else {
      console.error('FAIL: Score is too high, should be degraded.');
    }

    const cont = webhookScore.contributors;
    if (cont.failureRate < 0 && cont.latency < 0 && cont.workerHealth < 0 && cont.incidents < 0 && cont.blastRadius < 0 && cont.deployments < 0) {
      console.log('✓ SUCCESS: All explainable scoring deductions correctly computed.');
    } else {
      console.error('FAIL: Missing or incorrect contributor deductions:', cont);
    }
  }

  const serviceScore = scores.find(s => s.targetId === 'svc_payment_service' && s.targetType === 'service');
  if (!serviceScore) {
    console.error('FAIL: Service score not found!');
  } else {
    console.log('\n--- Verifying Service Reliability Score ---');
    console.log('Service Score:', serviceScore.score);
    console.log('Service Contributors:', serviceScore.contributors);
    if (serviceScore.score === webhookScore.score) {
      console.log('✓ SUCCESS: Service score averaged owned queues score.');
    } else {
      console.error('FAIL: Service score did not average queue scores.');
    }
  }

  console.log('\n5. Cleaning up test keys...');
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.del(servicesKey);
  await redis.del(dgKey);
  await redis.del(`queuewatch:project:${PROJECT_ID}:reliability_scores`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:deployments`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:telemetry`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:workers`);
  await redis.hdel(`queuewatch:project:${PROJECT_ID}:incidents`, INCIDENT_ID);
  await redis.del(`queuewatch:project:${PROJECT_ID}:reliability_history:webhook_delivery`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:reliability_history:svc_payment_service`);

  console.log('Done.');
  redis.disconnect();
}

main().catch(err => {
  console.error('E2E Test Error:', err);
  redis.disconnect();
});
