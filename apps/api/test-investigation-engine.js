const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

const PROJECT_ID = 'proj_test_investigation';
const API_KEY = 'qw_investigation_key_123';
const INCIDENT_ID = 'inc_investigation_123';
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
      name: 'E2E Investigation Test Project',
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
    id: 'log_inv_123',
    level: 'error',
    message: 'Postgres query connection pool timeout after 10000ms',
    queueName: 'payment_queue',
    timestamp: incidentTime + 1000,
  };
  await redis.lpush(`queuewatch:project:${PROJECT_ID}:logs`, JSON.stringify(logEvent));

  // Seed deployment (correlated regression - deployed 5 mins before incident)
  const depEvent = {
    id: 'dep_inv_123',
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
    deployments: ['dep_inv_123'],
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

  console.log('\n3. Querying SRE Investigation Copilot for "Why is payment_queue failing?"...');
  const queryRes = await fetch(`${ENDPOINT}/api/copilot/query`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ prompt: 'Why is payment_queue failing?' }),
  });

  if (!queryRes.ok) {
    throw new Error(`Query endpoint failed with status ${queryRes.status}`);
  }

  const responseObj = await queryRes.json();
  console.log('\n--- Copilot Structured Response ---');
  console.log(JSON.stringify(responseObj, null, 2));

  console.log('\n4. Verifying Evidence ranking (Primary, Secondary, Context)...');
  if (!responseObj.evidence || responseObj.evidence.length === 0) {
    throw new Error('FAIL: Evidence list is empty.');
  }

  for (const item of responseObj.evidence) {
    if (!item.id) {
      throw new Error(`FAIL: Evidence item is missing id. Item: ${JSON.stringify(item)}`);
    }
    if (!item.rank || !['primary', 'secondary', 'context'].includes(item.rank)) {
      throw new Error(`FAIL: Evidence item has invalid rank "${item.rank}". Item: ${JSON.stringify(item)}`);
    }
    console.log(`✓ Verified Evidence ID "${item.id}" is ranked "${item.rank}" (type: ${item.type})`);
  }

  console.log('\n5. Verifying Hypotheses Generation & Evidence Binding...');
  if (!responseObj.hypotheses || responseObj.hypotheses.length === 0) {
    throw new Error('FAIL: Hypotheses list is empty.');
  }

  for (const hyp of responseObj.hypotheses) {
    if (!hyp.id || !hyp.title || !hyp.description || typeof hyp.confidence !== 'number') {
      throw new Error(`FAIL: Hypothesis has missing metadata fields: ${JSON.stringify(hyp)}`);
    }
    if (!hyp.evidenceIds || !Array.isArray(hyp.evidenceIds) || hyp.evidenceIds.length === 0) {
      throw new Error(`FAIL: Hypothesis "${hyp.title}" is missing bound evidence IDs: ${JSON.stringify(hyp)}`);
    }
    // Verify that the bound evidence IDs actually match existing evidence items
    for (const evId of hyp.evidenceIds) {
      const matched = responseObj.evidence.find(e => e.id === evId);
      if (!matched) {
        throw new Error(`FAIL: Hypothesis "${hyp.title}" references non-existent evidence ID "${evId}".`);
      }
    }
    console.log(`✓ Verified Hypothesis "${hyp.title}" (${hyp.confidence}% confidence) is correctly bound to evidence IDs: ${JSON.stringify(hyp.evidenceIds)}`);
  }

  console.log('\n6. Verifying Chronological Root-Cause DAG Node Chains...');
  const graph = responseObj.investigationGraph;
  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    throw new Error('FAIL: Investigation graph is empty or has no nodes.');
  }

  console.log('Graph Nodes found:');
  graph.nodes.forEach(n => console.log(`  - Node: ID="${n.id}", Type="${n.type}", Label="${n.label}"`));

  console.log('Graph Edges found:');
  graph.edges.forEach(e => console.log(`  - Edge: "${e.from}" ➔ "${e.to}"`));

  // Verify chronological chain constraints
  // If deployment and log nodes exist, there should be an edge deployment -> log
  const depNode = graph.nodes.find(n => n.type === 'deployment');
  const logNode = graph.nodes.find(n => n.type === 'log');
  const incNode = graph.nodes.find(n => n.type === 'incident');
  const blastNode = graph.nodes.find(n => n.type === 'blast_radius');
  const actNode = graph.nodes.find(n => n.type === 'action');

  if (depNode && logNode) {
    const hasEdge = graph.edges.some(e => e.from === depNode.id && e.to === logNode.id);
    if (!hasEdge) throw new Error(`FAIL: Expected edge from deployment node (${depNode.id}) to log node (${logNode.id})`);
    console.log(`✓ Verified chronological edge: Deployment ➔ Log`);
  }

  if (logNode && incNode) {
    const hasEdge = graph.edges.some(e => e.from === logNode.id && e.to === incNode.id);
    if (!hasEdge) throw new Error(`FAIL: Expected edge from log node (${logNode.id}) to incident node (${incNode.id})`);
    console.log(`✓ Verified chronological edge: Log ➔ Incident`);
  }

  if (incNode && blastNode) {
    const hasEdge = graph.edges.some(e => e.from === incNode.id && e.to === blastNode.id);
    if (!hasEdge) throw new Error(`FAIL: Expected edge from incident node (${incNode.id}) to blast radius node (${blastNode.id})`);
    console.log(`✓ Verified chronological edge: Incident ➔ Blast Radius`);
  }

  if (blastNode && actNode) {
    const hasEdge = graph.edges.some(e => e.from === blastNode.id && e.to === actNode.id);
    if (!hasEdge) throw new Error(`FAIL: Expected edge from blast radius node (${blastNode.id}) to action node (${actNode.id})`);
    console.log(`✓ Verified chronological edge: Blast Radius ➔ Action`);
  }

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

  console.log('\n✓ SUCCESS: SRE Investigation Engine verified successfully.');
  redis.disconnect();
}

main().catch(err => {
  console.error('E2E Test Error:', err);
  redis.disconnect();
  process.exit(1);
});
