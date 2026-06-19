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
  // Clear any leftover keys from previous runs
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:knowledge_base`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:incidents`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:copilot_logs`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:reliability_scores`);

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
    recoveryTime: 12,
    blastRadius: ['svc_payment', 'svc_notification'],
    reliabilityImpact: 'Blast Radius: HIGH. Business Impact: degraded customer checkouts',
    runbooksExecuted: ['Database Pool Exhaustion Runbook'],
    finalOutcome: 'Resolved with runbook execution progress: 3/4 steps completed/skipped.',
    lessonsLearned: {
      whatHappened: 'A sudden surge in checkout requests saturated the db connection pool.',
      whatFixedIt: 'Increased connection limit to 50.',
      differentlyNextTime: 'Add connection pooling metrics warning alarms.'
    }
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
    recoveryTime: 8,
    blastRadius: ['svc_payment'],
    reliabilityImpact: 'Blast Radius: MEDIUM. Business Impact: failed webhook callback',
    runbooksExecuted: ['Dead-Letter Queue Recovery Runbook'],
    finalOutcome: 'Resolved with runbook execution progress: 2/2 steps completed/skipped.'
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

  // Seed reliability scores to test report stable services
  const score1 = { targetId: 'svc_payment', targetType: 'service', score: 96, timestamp: Date.now() };
  const score2 = { targetId: 'svc_notification', targetType: 'service', score: 88, timestamp: Date.now() };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:reliability_scores`, `service:svc_payment`, JSON.stringify(score1));
  await redis.hset(`queuewatch:project:${PROJECT_ID}:reliability_scores`, `service:svc_notification`, JSON.stringify(score2));

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
    throw new Error('FAIL: Expected similar incidents!');
  }
  
  const match = similarityList[0];
  console.log(`Matched Incident: ${match.title}`);
  console.log(`Similarity Score: ${match.similarityScore}%`);
  if (match.similarityScore < 20) {
    throw new Error(`FAIL: Similarity score ${match.similarityScore}% is below expected threshold 20%!`);
  }
  if (!match.resolution.includes('Increased database connection pool limit')) {
    throw new Error('FAIL: Similar incident does not contain resolution details!');
  }
  if (match.recoveryTime !== 12) {
    throw new Error(`FAIL: Expected recoveryTime to be 12, got ${match.recoveryTime}`);
  }
  if (match.lessonsLearned.whatFixedIt !== 'Increased connection limit to 50.') {
    throw new Error(`FAIL: Lessons learned not populated correctly!`);
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

  if (!copilotAnswer.answer.includes('Resolution: Database Connection Pool Exhaustion') ||
      !copilotAnswer.answer.includes('Increased connection limit to 50.')) {
    throw new Error('FAIL: Copilot response did not retrieve historical database lessons-learned feedback!');
  }
  console.log('✓ Copilot contextual memory recall passed.');

  console.log('\n7. Testing Dynamic Recurring Patterns (GET /api/copilot/recurring-incidents)...');
  const recurringRes = await fetch(`${ENDPOINT}/api/copilot/recurring-incidents`, {
    headers: authHeaders,
  });

  if (!recurringRes.ok) {
    throw new Error(`Recurring incidents failed: ${recurringRes.status}`);
  }

  const patterns = await recurringRes.json();
  console.log('Recurring Failure Patterns:', JSON.stringify(patterns, null, 2));

  const dbPattern = patterns.find(p => p.pattern.includes('Database'));
  if (!dbPattern) {
    throw new Error('FAIL: Database failure pattern not aggregated!');
  }
  if (dbPattern.occurrences !== 2) {
    throw new Error(`FAIL: Expected 2 occurrences, got ${dbPattern.occurrences}`);
  }
  if (dbPattern.averageRecoveryTime !== 12) {
    throw new Error(`FAIL: Expected average recovery time of 12, got ${dbPattern.averageRecoveryTime}`);
  }
  if (dbPattern.successRate !== 50) {
    // 1 resolved out of 2 total incidents
    throw new Error(`FAIL: Expected 50% success rate, got ${dbPattern.successRate}`);
  }
  console.log('✓ Recurring patterns metrics assertions passed.');

  console.log('\n8. Testing SRE Knowledge Articles (GET /api/copilot/knowledge-articles)...');
  const articlesRes = await fetch(`${ENDPOINT}/api/copilot/knowledge-articles`, {
    headers: authHeaders,
  });

  if (!articlesRes.ok) {
    throw new Error(`Knowledge articles request failed: ${articlesRes.status}`);
  }

  const artList = await articlesRes.json();
  console.log('Knowledge Articles:', JSON.stringify(artList, null, 2));

  if (artList.length === 0 || !artList.some(a => a.pattern.includes('Database'))) {
    throw new Error('FAIL: Expected Database Pool Exhaustion article details!');
  }
  console.log('✓ SRE Knowledge Articles assertions passed.');

  console.log('\n9. Testing SRE Reliability Reports & Leaderboard (GET /api/copilot/reliability-reports)...');
  const reportsRes = await fetch(`${ENDPOINT}/api/copilot/reliability-reports`, {
    headers: authHeaders,
  });

  if (!reportsRes.ok) {
    throw new Error(`Reliability reports request failed: ${reportsRes.status}`);
  }

  const reports = await reportsRes.json();
  console.log('Reliability Reports & Leaderboard:', JSON.stringify(reports, null, 2));

  if (reports.weeklySummary.averageReliabilityScore !== 92) {
    // Average of 96 and 88 is 92
    throw new Error(`FAIL: Expected average reliability score 92, got ${reports.weeklySummary.averageReliabilityScore}`);
  }
  if (reports.weeklySummary.meanTimeToRecoveryMin !== 10) {
    // Average of 12 and 8 is 10
    throw new Error(`FAIL: Expected MTTR to be 10, got ${reports.weeklySummary.meanTimeToRecoveryMin}`);
  }
  if (reports.leaderboard.mostStableServices[0].name !== 'payment') {
    throw new Error(`FAIL: Expected payment service to be most stable, got ${reports.leaderboard.mostStableServices[0].name}`);
  }
  console.log('✓ SRE Reliability Reports & Leaderboard assertions passed.');

  console.log('\n10. Testing Incident Resolution with Postmortem Feedback (PATCH /api/incidents/:id/resolve)...');
  const resolveBody = {
    summary: 'Resolved via scaling concurrency up and database connection pool expansion.',
    feedback: {
      whatHappened: 'A massive queue overflow blocked thread execution on worker node payment_queue.',
      whatFixedIt: 'Increased concurrency parameter from 10 to 30 and recycled active connection pools.',
      differentlyNextTime: 'Implement automatic circuit-breaker controls on pool exhaustion spikes.'
    }
  };

  const resolveRes = await fetch(`${ENDPOINT}/api/incidents/${NEW_INCIDENT_ID}/resolve`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify(resolveBody),
  });

  if (!resolveRes.ok) {
    throw new Error(`Incident resolve request failed with status ${resolveRes.status}`);
  }

  // Retrieve KnowledgeEntries to verify our new entry has been saved with postmortem feedback
  const updatedEntriesRes = await fetch(`${ENDPOINT}/api/copilot/knowledge-base`, {
    headers: authHeaders,
  });
  const updatedEntries = await updatedEntriesRes.json();
  console.log('Updated Knowledge Entries:', JSON.stringify(updatedEntries, null, 2));

  const newEntry = updatedEntries.find(e => e.incidentId === NEW_INCIDENT_ID);
  if (!newEntry) {
    throw new Error('FAIL: Expected new knowledge base entry to be saved on resolution!');
  }
  if (newEntry.lessonsLearned.whatFixedIt !== resolveBody.feedback.whatFixedIt) {
    throw new Error(`FAIL: Expected lessonsLearned feedback to match resolved payload, got ${JSON.stringify(newEntry.lessonsLearned)}`);
  }
  console.log('✓ Incident postmortem feedback form collection successfully verified.');

  console.log('\n11. Cleaning up test keys...');
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:knowledge_base`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:incidents`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:copilot_logs`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:reliability_scores`);
  console.log('E2E Reliability Knowledge Base & Intel verification test completed successfully.');
  redis.disconnect();
}

main().catch(err => {
  console.error('FAIL: E2E Verification failed.', err);
  redis.disconnect();
  process.exit(1);
});
