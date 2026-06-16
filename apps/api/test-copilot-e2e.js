const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

const PROJECT_ID = 'proj_test_copilot';
const API_KEY = 'qw_copilot_key_123';
const INCIDENT_ID = 'inc_copilot_123';
const ENDPOINT = 'http://localhost:3001';

async function main() {
  console.log('1. Seeding project metadata, services, metrics, and logs in Redis...');

  const now = Date.now();
  const depTime = now - 10 * 60 * 1000;      // 10 min ago
  const incidentTime = now - 5 * 60 * 1000; // 5 min ago

  // Seed project
  await redis.set(
    `queuewatch:project_metadata:${PROJECT_ID}`,
    JSON.stringify({
      id: PROJECT_ID,
      name: 'E2E Copilot Test Project',
      apiKey: API_KEY,
      createdAt: Date.now(),
      hasReceivedTelemetry: true,
    })
  );

  // Seed project queue set
  await redis.sadd(`queuewatch:project:${PROJECT_ID}:queues`, 'payment_queue');

  // Link to SRE demo user
  await redis.sadd('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);

  // Seed API key mapping
  await redis.set(
    `queuewatch:api_keys:${API_KEY}`,
    JSON.stringify({ projectId: PROJECT_ID, userId: 'demo_user_sre_910' })
  );

  // Seed active incident
  const incidentObj = {
    id: INCIDENT_ID,
    title: 'Payment processing error spike',
    severity: 'critical',
    affectedQueue: 'payment_queue',
    status: 'open',
    firstDetectedAt: incidentTime,
    lastUpdatedAt: incidentTime,
    summary: 'Spike in BullMQ failures on payment_queue.',
    evidence: 'Failed jobs count > 10',
    suspectedRootCause: 'Database pool lock contention.',
    recommendation: 'Check postgres connection pools.',
    impact: 'Billing requests failed.',
    relatedErrors: ['ETIMEDOUT: database connection timeout'],
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, INCIDENT_ID, JSON.stringify(incidentObj));

  // Seed error logs
  const logEvent = {
    id: 'log_cop_123',
    level: 'error',
    message: 'Postgres query connection pool timeout after 10000ms',
    queueName: 'payment_queue',
    timestamp: incidentTime + 1000,
  };
  await redis.lpush(`queuewatch:project:${PROJECT_ID}:logs`, JSON.stringify(logEvent));

  // Seed deployment (correlated regression - deployed 5 mins before incident)
  const depEvent = {
    id: 'dep_cop_123',
    service: 'payment_queue',
    version: 'v1.9.9',
    commitSha: 'commit99999999',
    branch: 'release/v1.9.9',
    environment: 'production',
    deployedBy: 'SRE Coordinator',
    deployedAt: depTime,
  };
  await redis.lpush(`queuewatch:project:${PROJECT_ID}:deployments`, JSON.stringify(depEvent));

  // Seed reliability score in Redis
  const reliabilityScore = {
    id: `score_payment_queue_${now}`,
    targetId: 'payment_queue',
    targetType: 'queue',
    score: 40,
    failureRate: 35,
    retryRate: 0,
    backlogGrowth: 0,
    workerHealthScore: 100,
    incidentFrequency: 1,
    timestamp: now,
    contributors: {
      failureRate: -15,
      latency: -15,
      workerHealth: 0,
      incidents: -25,
      blastRadius: -5,
      deployments: 0
    }
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:reliability_scores`, `queue:payment_queue`, JSON.stringify(reliabilityScore));

  // Seed service registry mapping
  const paymentServiceObj = {
    id: 'svc_payment',
    name: 'payment-service',
    description: 'Handles Stripe card charges',
    environment: 'production',
    owner: 'Billing SRE',
    status: 'critical',
    createdAt: now,
    queues: ['payment_queue'],
    workers: ['worker_pay_1'],
    deployments: ['dep_cop_123'],
    incidents: [INCIDENT_ID]
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:services`, 'svc_payment', JSON.stringify(paymentServiceObj));

  // Seed dependency graph showing downstream affected nodes
  const dependencyGraph = {
    nodes: [
      { id: 'svc_payment', label: 'payment-service', type: 'service' },
      { id: 'payment_queue', label: 'payment_queue', type: 'queue' },
      { id: 'email_notifications', label: 'email_notifications', type: 'queue' },
      { id: 'svc_notifications', label: 'notification-service', type: 'service' }
    ],
    edges: [
      { from: 'svc_payment', to: 'payment_queue' },
      { from: 'payment_queue', to: 'email_notifications' },
      { from: 'email_notifications', to: 'svc_notifications' }
    ],
    serviceImpacts: {
      'svc_payment': ['svc_notifications']
    }
  };
  await redis.set(`queuewatch:project:${PROJECT_ID}:dependency_graph`, JSON.stringify(dependencyGraph));

  console.log('2. Requesting auth token from SRE login...');
  const loginRes = await fetch(`${ENDPOINT}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'demo@queuewatch.dev',
      password: 'password123',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Auth failed with status ${loginRes.status}`);
  }

  const { token } = await loginRes.json();
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-project-id': PROJECT_ID,
  };

  console.log('3. Fetching suggested queries endpoint...');
  const suggestionsRes = await fetch(`${ENDPOINT}/api/copilot/suggestions`, {
    headers: authHeaders,
  });
  const suggestionsList = await suggestionsRes.json();
  console.log(`Suggested queries count: ${suggestionsList.length}`);
  if (suggestionsList.length === 0) {
    throw new Error('FAIL: Expected suggestions to be populated!');
  }

  console.log('\n4. Testing POST query with target queue "payment_queue"...');
  const queryRes = await fetch(`${ENDPOINT}/api/copilot/query`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ prompt: 'Why is payment_queue failing?' }),
  });

  if (!queryRes.ok) {
    throw new Error(`Query endpoint failed with status ${queryRes.status}`);
  }

  const queryResponse = await queryRes.json();
  console.log('\n--- Structured Copilot Query Response ---');
  console.log(JSON.stringify(queryResponse, null, 2));

  // Assertions on structured query response
  if (queryResponse.confidence !== 'high' && queryResponse.confidence !== 'medium') {
    throw new Error(`FAIL: Expected high/medium confidence. Got ${queryResponse.confidence}`);
  }
  if (!queryResponse.evidence || queryResponse.evidence.length === 0) {
    throw new Error('FAIL: Expected evidence array to be populated!');
  }
  
  // Assert presence of dynamic evidence types
  const evidenceTypes = queryResponse.evidence.map(e => e.type);
  console.log('Evidence Types detected:', evidenceTypes);
  if (!evidenceTypes.includes('score')) throw new Error('FAIL: Expected score evidence.');
  if (!evidenceTypes.includes('incident')) throw new Error('FAIL: Expected incident evidence.');
  if (!evidenceTypes.includes('log')) throw new Error('FAIL: Expected log evidence.');
  if (!evidenceTypes.includes('deployment')) throw new Error('FAIL: Expected deployment evidence.');
  if (!evidenceTypes.includes('graph')) throw new Error('FAIL: Expected graph blast radius evidence.');

  // Assert structured recommended actions
  const actionTypes = queryResponse.recommendedActions.map(a => a.type);
  console.log('Action Recommendations detected:', actionTypes);
  if (!actionTypes.includes('pause_queue')) throw new Error('FAIL: Expected pause_queue recommendation.');
  if (!actionTypes.includes('replay_dlq')) throw new Error('FAIL: Expected replay_dlq recommendation.');
  if (!actionTypes.includes('ack_incident')) throw new Error('FAIL: Expected ack_incident recommendation.');
  if (queryResponse.requiresConfirmation !== true) throw new Error('FAIL: Expected confirmation requirement.');

  console.log('\n5. Testing POST incident chat with incident context...');
  const chatRes = await fetch(`${ENDPOINT}/api/copilot/incident/${INCIDENT_ID}/chat`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ prompt: 'Explain the root cause and downstream effects.' }),
  });
  
  if (!chatRes.ok) {
    throw new Error(`Chat endpoint failed: ${chatRes.status}`);
  }

  const chatResponse = await chatRes.json();
  console.log(`Incident Chat Answer length: ${chatResponse.answer.length}`);
  const chatEvidenceTypes = chatResponse.evidence.map(e => e.type);
  if (!chatEvidenceTypes.includes('graph')) {
    throw new Error('FAIL: Expected graph context in incident chat response.');
  }

  console.log('\n6. Checking investigation log history in Redis...');
  const logsRes = await fetch(`${ENDPOINT}/api/copilot/logs`, {
    headers: authHeaders,
  });
  const historyLogs = await logsRes.json();
  console.log(`Investigation log count retrieved: ${historyLogs.length}`);
  if (historyLogs.length < 2) {
    throw new Error('FAIL: Expected both query and chat runs to be saved in audit log.');
  }
  
  const lastLog = historyLogs[0];
  console.log('Audit Log Example:');
  console.log(`- Question: ${lastLog.question}`);
  console.log(`- Answer snippet: ${lastLog.answer.substring(0, 100)}...`);
  console.log(`- Confidence: ${lastLog.confidence}`);
  console.log(`- Evidence Count: ${lastLog.evidence.length}`);

  console.log('\n7. Cleaning up test keys...');
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.hdel(`queuewatch:project:${PROJECT_ID}:incidents`, INCIDENT_ID);
  await redis.del(`queuewatch:project:${PROJECT_ID}:logs`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:deployments`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:queues`);
  await redis.hdel(`queuewatch:project:${PROJECT_ID}:reliability_scores`, `queue:payment_queue`);
  await redis.hdel(`queuewatch:project:${PROJECT_ID}:services`, 'svc_payment');
  await redis.del(`queuewatch:project:${PROJECT_ID}:dependency_graph`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:copilot_history`);

  console.log('\n✓ SUCCESS: AI Copilot E2E simulation verified successfully.');
  redis.disconnect();
}

main().catch(err => {
  console.error('E2E Test Error:', err);
  redis.disconnect();
  process.exit(1);
});
