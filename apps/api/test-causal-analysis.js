const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

const PROJECT_ID = 'proj_test_causal';
const API_KEY = 'qw_causal_key_123';
const INCIDENT_ID = 'inc_causal_123';
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
      name: 'E2E Causal Test Project',
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
    evidence: 'Failed jobs count > 10 (32% failure rate)',
    suspectedRootCause: 'Database pool lock contention.',
    recommendation: 'Check postgres connection pools.',
    impact: 'Billing requests failed.',
    relatedErrors: ['ETIMEDOUT: database connection timeout'],
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, INCIDENT_ID, JSON.stringify(incidentObj));

  // Seed error logs
  const logEvent = {
    id: 'log_causal_123',
    level: 'error',
    message: 'Postgres query connection pool timeout after 10000ms',
    queueName: 'payment_queue',
    timestamp: incidentTime + 1000,
  };
  await redis.lpush(`queuewatch:project:${PROJECT_ID}:logs`, JSON.stringify(logEvent));

  // Seed deployment (correlated regression - deployed 5 mins before incident)
  const depEvent = {
    id: 'dep_causal_123',
    service: 'payment_queue',
    version: 'v2.1.4',
    commitSha: 'commit214214214',
    branch: 'release/v2.1.4',
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
    deployments: ['dep_causal_123'],
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

  console.log('\n3. Testing POST query with target queue "payment_queue" to reconstruct causal chain...');
  const queryRes = await fetch(`${ENDPOINT}/api/copilot/query`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ prompt: 'Why is payment_queue failing? Reconstruct the advanced causal analysis.' }),
  });

  if (!queryRes.ok) {
    throw new Error(`Query endpoint failed with status ${queryRes.status}`);
  }

  const queryResponse = await queryRes.json();
  console.log('\n--- Structured Causal Analysis Response ---');
  console.log(JSON.stringify(queryResponse, null, 2));

  // Assertions on the chronological SRE narrative text structure
  console.log('\n4. Verifying Copilot Chronological SRE Narrative text format...');
  const narrative = queryResponse.answer;
  if (!narrative) {
    throw new Error('FAIL: Expected response.answer to be populated!');
  }

  // Keywords that must exist in narrative summary
  const requiredKeywords = ['UTC', 'deployment', 'memory', 'latency', 'Failure rate', 'stabilized'];
  for (const keyword of requiredKeywords) {
    if (!narrative.includes(keyword)) {
      throw new Error(`FAIL: Narrative summary missing required keyword: "${keyword}"`);
    }
  }
  console.log('✓ Narrative summary verified. Contains all required chronological SRE details.');

  // Assertions on causal investigation graph
  console.log('\n5. Verifying Causal Nodes and Edge Confidence/Rationales...');
  const graph = queryResponse.investigationGraph;
  if (!graph || !graph.nodes || !graph.edges) {
    throw new Error('FAIL: Expected investigationGraph to be fully populated with nodes and edges!');
  }

  // Assert node types: deployment, metric, log, incident, impact, runbook, recovery
  const nodeTypes = new Set(graph.nodes.map(n => n.type));
  console.log('Graph Node Types detected:', Array.from(nodeTypes));
  
  const expectedTypes = ['deployment', 'metric', 'log', 'incident', 'impact', 'runbook', 'recovery'];
  for (const type of expectedTypes) {
    if (!nodeTypes.has(type)) {
      throw new Error(`FAIL: Graph missing expected node type: "${type}"`);
    }
  }
  console.log('✓ All 7 expected node types exist in the causal graph.');

  // Assert edge confidence and rationales
  if (graph.edges.length === 0) {
    throw new Error('FAIL: Expected graph edges to connect the nodes!');
  }

  for (const edge of graph.edges) {
    if (edge.confidence === undefined || typeof edge.confidence !== 'number' || edge.confidence < 0 || edge.confidence > 100) {
      throw new Error(`FAIL: Edge from "${edge.from}" to "${edge.to}" has invalid confidence score: ${edge.confidence}`);
    }
    if (!edge.rationale || typeof edge.rationale !== 'string') {
      throw new Error(`FAIL: Edge from "${edge.from}" to "${edge.to}" has missing or invalid rationale: "${edge.rationale}"`);
    }
  }
  console.log('✓ All edges contain valid confidence percentages and text rationales.');

  console.log('\n6. Cleaning up causal analysis test keys...');
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

  console.log('\n✓ SUCCESS: AI Advanced Causal Analysis E2E verification completed successfully.');
  redis.disconnect();
}

main().catch(err => {
  console.error('E2E Test Error:', err);
  redis.disconnect();
  process.exit(1);
});
