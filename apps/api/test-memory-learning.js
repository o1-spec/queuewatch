const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

const PROJECT_ID = 'proj_memory_test_999';
const API_KEY = 'qw_memory_test_key_999';
const OLD_INCIDENT_ID = 'inc_old_db_leak';
const NEW_INCIDENT_ID = 'inc_new_db_leak';
const ENDPOINT = 'http://localhost:3001';

async function main() {
  console.log('1. Seeding test project, API key, and user in Redis...');
  
  // Seed project metadata
  await redis.set(
    `queuewatch:project_metadata:${PROJECT_ID}`,
    JSON.stringify({
      id: PROJECT_ID,
      name: 'E2E Memory Learning Test Project',
      apiKey: API_KEY,
      createdAt: Date.now(),
      hasReceivedTelemetry: true,
    })
  );

  // Link project to admin user
  await redis.sadd('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);

  // Seed API key mapping
  await redis.set(
    `queuewatch:api_keys:${API_KEY}`,
    JSON.stringify({ projectId: PROJECT_ID, userId: 'demo_user_sre_910' })
  );

  console.log('2. Seeding historical resolved incidents into knowledge base...');
  
  // Historical resolved database incident
  const dbKnowledge = {
    id: 'know_db_leak_001',
    title: 'Resolution: Database Connection Pool Exhaustion',
    incidentId: OLD_INCIDENT_ID,
    pattern: 'Postgres query connection pool timeout after 10000ms',
    rootCause: 'Database pool leak due to unreleased client connection in query transaction.',
    resolution: 'Increased database connection pool limit from 20 to 50 and recycled container tasks.',
    preventionRecommendation: 'Wrap all query connections in auto-close resource blocks.',
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    evidence: 'Postgres query connection pool timeout after 10000ms',
    hypotheses: ['Database pool exhaustion'],
    resolutionTimeMin: 12,
    blastRadius: ['svc_payment', 'svc_notification'],
    reliabilityImpact: 'Blast Radius: HIGH. Business Impact: degraded customer checkouts'
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:knowledge_base`, dbKnowledge.id, JSON.stringify(dbKnowledge));

  // Seed another historical incident of a different category for trend analysis
  const dlqKnowledge = {
    id: 'know_dlq_001',
    title: 'Resolution: Dead-Letter Queue Saturation',
    incidentId: 'inc_old_dlq',
    pattern: 'DLQ size exceeds SLA bounds',
    rootCause: 'Poison pill payload containing invalid user billing address structure.',
    resolution: 'Implemented strict schema validation in webhook handler.',
    preventionRecommendation: 'Reject invalid formats at edge entry point.',
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    evidence: 'Dead-letter queue size spiked above 100.',
    hypotheses: ['DLQ Growth'],
    resolutionTimeMin: 8,
    blastRadius: ['svc_payment'],
    reliabilityImpact: 'Blast Radius: MEDIUM. Business Impact: failed webhook callback'
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:knowledge_base`, dlqKnowledge.id, JSON.stringify(dlqKnowledge));

  // Also seed a historical resolved incident to ensure dynamic categorization trend is calculated
  const pastResolvedIncident1 = {
    id: OLD_INCIDENT_ID,
    title: 'Postgres database connection pool timeout exception',
    severity: 'critical',
    affectedQueue: 'payment_queue',
    status: 'resolved',
    firstDetectedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    lastUpdatedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    summary: 'The job failure rate on queue payment_queue is currently 25%.',
    evidence: 'Failed jobs count: 12 out of 48 runs.',
    suspectedRootCause: 'Database pool leak due to unreleased client connection in query transaction.',
    recommendation: 'Wrap all query connections in auto-close resource blocks.',
    impact: 'Customers cannot complete checkout transactions.',
    relatedErrors: ['Postgres query connection pool timeout'],
    resolvedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, OLD_INCIDENT_ID, JSON.stringify(pastResolvedIncident1));

  const pastResolvedIncident2 = {
    id: 'inc_old_dlq',
    title: 'DLQ size exceeds SLA bounds on project',
    severity: 'high',
    affectedQueue: 'dead_letter_queue',
    status: 'resolved',
    firstDetectedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    lastUpdatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    summary: 'The dead-letter queue job count is currently 105.',
    evidence: 'Total dead-letter jobs: 105.',
    suspectedRootCause: 'Poison pill payload containing invalid user billing address structure.',
    recommendation: 'Reject invalid formats at edge entry point.',
    impact: 'Failed webhook callbacks.',
    resolvedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, 'inc_old_dlq', JSON.stringify(pastResolvedIncident2));

  console.log('3. Logging in to acquire JWT token...');
  const loginRes = await fetch(`${ENDPOINT}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'demo@queuewatch.dev',
      password: 'password123',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}`);
  }

  const { token } = await loginRes.json();
  console.log('JWT Token successfully acquired.');

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-project-id': PROJECT_ID,
  };

  console.log('4. Creating a new active database incident to trigger similarity...');
  const newIncident = {
    id: NEW_INCIDENT_ID,
    title: 'Postgres database connection pool timeout spike',
    severity: 'critical',
    affectedQueue: 'payment_queue',
    status: 'open',
    firstDetectedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    summary: 'Database connection pool timed out after waiting 10000ms. Outage detected.',
    evidence: 'Postgres query connection pool timeout after 10000ms exception.',
    suspectedRootCause: 'Database connection limits saturation.',
    recommendation: 'Verify active connection limits.',
    impact: 'Checkout and billing queues are blocked.',
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, NEW_INCIDENT_ID, JSON.stringify(newIncident));

  console.log('\n5. Testing Similarity Endpoint (GET /api/incidents/:id/similar)...');
  const simRes = await fetch(`${ENDPOINT}/api/incidents/${NEW_INCIDENT_ID}/similar`, {
    headers: authHeaders,
  });

  if (!simRes.ok) {
    throw new Error(`Similarity request failed: ${simRes.status}`);
  }

  const similarityList = await simRes.json();
  console.log('Similarity Results:', JSON.stringify(similarityList, null, 2));

  // Assertions for similarity
  if (similarityList.length === 0) {
    throw new Error('FAIL: Expected at least 1 similar incident in response!');
  }
  const match = similarityList[0];
  console.log(`Matched Incident: ${match.title}`);
  console.log(`Similarity Score: ${match.similarityScore}%`);
  if (match.similarityScore < 20) {
    throw new Error(`FAIL: Similarity score ${match.similarityScore}% is below expected threshold 20%!`);
  }
  if (!match.resolution.includes('Increased database connection pool limit')) {
    throw new Error('FAIL: Similar incident match does not contain resolution details!');
  }
  console.log('✓ Similarity assertions passed.');

  console.log('\n6. Testing Copilot Query Context Retrieval (POST /api/copilot/query)...');
  const copilotRes = await fetch(`${ENDPOINT}/api/copilot/query`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      prompt: 'Have we seen this postgres connection pool issue before? What solved it?'
    })
  });

  if (!copilotRes.ok) {
    throw new Error(`Copilot query failed: ${copilotRes.status}`);
  }

  const copilotAnswer = await copilotRes.json();
  console.log('Copilot Answer Output excerpt:');
  console.log(copilotAnswer.answer);

  if (!copilotAnswer.answer.includes('Resolution: Database Connection Pool Exhaustion') &&
      !copilotAnswer.answer.includes('connection pool limit from 20 to 50')) {
    throw new Error('FAIL: Copilot response did not retrieve and suggest the historical database resolution!');
  }
  console.log('✓ Copilot contextual memory recall passed.');

  console.log('\n7. Testing Reliability Trends Endpoint (GET /api/copilot/reliability-trends)...');
  const trendsRes = await fetch(`${ENDPOINT}/api/copilot/reliability-trends`, {
    headers: authHeaders,
  });

  if (!trendsRes.ok) {
    throw new Error(`Trends request failed: ${trendsRes.status}`);
  }

  const trends = await trendsRes.json();
  console.log('Reliability Trends:', JSON.stringify(trends, null, 2));

  if (trends.totalIncidents !== 3) {
    throw new Error(`FAIL: Expected totalIncidents to be 3, got ${trends.totalIncidents}`);
  }
  if (trends.categories.databaseIssues !== 2) {
    throw new Error(`FAIL: Expected databaseIssues to be 2, got ${trends.categories.databaseIssues}`);
  }
  if (trends.categories.dlqGrowth !== 1) {
    throw new Error(`FAIL: Expected dlqGrowth to be 1, got ${trends.categories.dlqGrowth}`);
  }
  console.log('✓ Reliability trends category counts passed.');

  console.log('\n8. Cleaning up test keys...');
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:knowledge_base`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:incidents`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:copilot_logs`);
  console.log('E2E Memory Learning verification test completed successfully.');
  redis.disconnect();
}

main().catch(err => {
  console.error('FAIL: E2E Verification failed.', err);
  redis.disconnect();
  process.exit(1);
});
