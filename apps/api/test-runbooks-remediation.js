const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

const PROJECT_ID = 'proj_test_runbook';
const API_KEY = 'qw_test_key_runbook';
const INCIDENT_ID = 'inc_test_runbook';
const ENDPOINT = 'http://localhost:3001';

async function main() {
  console.log('1. Seeding project, API key, user, and incident in Redis...');

  // Seed project metadata
  await redis.set(
    `queuewatch:project_metadata:${PROJECT_ID}`,
    JSON.stringify({
      id: PROJECT_ID,
      name: 'E2E Runbook Test Project',
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

  // Seed incident in Redis with database connection pool exhaustion keyword
  const incidentObj = {
    id: INCIDENT_ID,
    title: 'Database connection pool exhaustion on payment_queue',
    severity: 'critical',
    affectedQueue: 'payment_queue',
    status: 'open',
    firstDetectedAt: Date.now() - 5 * 60 * 1000,
    lastUpdatedAt: Date.now() - 5 * 60 * 1000,
    summary: 'Connection pool lock contention detected on database hosts.',
    evidence: 'Failed jobs count: 12 out of 48 runs.',
    suspectedRootCause: 'Slow query pool limit.',
    recommendation: 'Verify database connection configuration.',
    impact: 'Customers cannot complete checkout transactions.',
    relatedErrors: ['Database query pool timeout'],
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, INCIDENT_ID, JSON.stringify(incidentObj));

  console.log('2. Logging in to acquire JWT token...');
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

  console.log('\n3. Testing GET suggested runbooks...');
  const getRunbooksRes = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/runbooks`, {
    headers: authHeaders,
  });

  if (!getRunbooksRes.ok) {
    throw new Error(`Get runbooks failed: ${getRunbooksRes.status}`);
  }

  const suggestedRunbooks = await getRunbooksRes.json();
  console.log('Suggested Runbooks:');
  console.log(JSON.stringify(suggestedRunbooks, null, 2));

  // Assertions for suggested runbooks
  if (!Array.isArray(suggestedRunbooks) || suggestedRunbooks.length === 0) {
    throw new Error('FAIL: Suggested runbooks should be a non-empty array!');
  }

  const dbPoolRunbook = suggestedRunbooks.find(r => r.id === 'run_db_pool_exhaustion');
  if (!dbPoolRunbook) {
    throw new Error('FAIL: Database Pool Exhaustion Runbook not suggested!');
  }
  console.log('✓ Found Database Pool Exhaustion Runbook suggestion.');

  console.log('\n4. Updating step index 0 status to IN_PROGRESS...');
  const patchStep1Res = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/runbooks/run_db_pool_exhaustion/steps/0`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'in_progress' }),
  });

  if (!patchStep1Res.ok) {
    throw new Error(`Patch step 0 in_progress failed: ${patchStep1Res.status}`);
  }

  const step1Updated = await patchStep1Res.json();
  console.log('Updated step 0 status:', step1Updated.steps[0].status);
  if (step1Updated.steps[0].status !== 'in_progress') {
    throw new Error(`FAIL: Step 0 status should be in_progress, got ${step1Updated.steps[0].status}`);
  }
  console.log('✓ Step 0 status successfully set to in_progress.');

  console.log('\n5. Updating step index 0 status to COMPLETED...');
  const patchStep2Res = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/runbooks/run_db_pool_exhaustion/steps/0`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'completed' }),
  });

  if (!patchStep2Res.ok) {
    throw new Error(`Patch step 0 completed failed: ${patchStep2Res.status}`);
  }

  const step2Updated = await patchStep2Res.json();
  console.log('Updated step 0 status:', step2Updated.steps[0].status);
  if (step2Updated.steps[0].status !== 'completed') {
    throw new Error(`FAIL: Step 0 status should be completed, got ${step2Updated.steps[0].status}`);
  }
  console.log('✓ Step 0 status successfully set to completed.');

  console.log('\n5b. Updating step index 0 status to SKIPPED...');
  const patchStepSkippedRes = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/runbooks/run_db_pool_exhaustion/steps/0`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'skipped' }),
  });

  if (!patchStepSkippedRes.ok) {
    throw new Error(`Patch step 0 skipped failed: ${patchStepSkippedRes.status}`);
  }

  const stepSkippedUpdated = await patchStepSkippedRes.json();
  console.log('Updated step 0 status:', stepSkippedUpdated.steps[0].status);
  if (stepSkippedUpdated.steps[0].status !== 'skipped') {
    throw new Error(`FAIL: Step 0 status should be skipped, got ${stepSkippedUpdated.steps[0].status}`);
  }
  console.log('✓ Step 0 status successfully set to skipped.');

  console.log('\n5c. Updating step index 0 status to BLOCKED...');
  const patchStepBlockedRes = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/runbooks/run_db_pool_exhaustion/steps/0`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ status: 'blocked' }),
  });

  if (!patchStepBlockedRes.ok) {
    throw new Error(`Patch step 0 blocked failed: ${patchStepBlockedRes.status}`);
  }

  const stepBlockedUpdated = await patchStepBlockedRes.json();
  console.log('Updated step 0 status:', stepBlockedUpdated.steps[0].status);
  if (stepBlockedUpdated.steps[0].status !== 'blocked') {
    throw new Error(`FAIL: Step 0 status should be blocked, got ${stepBlockedUpdated.steps[0].status}`);
  }
  console.log('✓ Step 0 status successfully set to blocked.');

  console.log('\n6. Fetching incident timeline to verify step progress event integration...');
  const getTimelineRes = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/timeline`, {
    headers: authHeaders,
  });

  if (!getTimelineRes.ok) {
    throw new Error(`Get timeline failed: ${getTimelineRes.status}`);
  }

  const timeline = await getTimelineRes.json();
  console.log('Incident Timeline:');
  console.log(JSON.stringify(timeline, null, 2));

  const runbookEvents = timeline.filter(e => e.event === 'runbook.step_progress');
  if (runbookEvents.length === 0) {
    throw new Error('FAIL: Timeline does not contain any runbook.step_progress events!');
  }

  const hasStarted = runbookEvents.some(e => e.desc.includes('started'));
  const hasCompleted = runbookEvents.some(e => e.desc.includes('completed successfully'));
  const hasSkipped = runbookEvents.some(e => e.desc.includes('skipped'));
  const hasBlocked = runbookEvents.some(e => e.desc.includes('blocked'));

  if (!hasStarted) throw new Error('FAIL: Timeline missing step started progress event!');
  if (!hasCompleted) throw new Error('FAIL: Timeline missing step completed progress event!');
  if (!hasSkipped) throw new Error('FAIL: Timeline missing step skipped progress event!');
  if (!hasBlocked) throw new Error('FAIL: Timeline missing step blocked progress event!');
  
  console.log('✓ Timeline successfully contains started, completed, skipped, and blocked events.');

  console.log('\n7. Cleaning up E2E test keys...');
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.hdel(`queuewatch:project:${PROJECT_ID}:incidents`, INCIDENT_ID);
  await redis.del(`queuewatch:project:${PROJECT_ID}:incident:${INCIDENT_ID}:timeline`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:incident:${INCIDENT_ID}:runbooks`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:incident:${INCIDENT_ID}:runbook_events`);

  console.log('Done.');
  redis.disconnect();
}

main().catch(err => {
  console.error('E2E Test Error:', err);
  redis.disconnect();
  process.exit(1);
});
