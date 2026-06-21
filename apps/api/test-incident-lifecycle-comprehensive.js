const Redis = require('ioredis');

const ENDPOINT = 'http://localhost:3001';
const PROJECT_ID = `proj_incident_lifecycle_${Date.now()}`;
const API_KEY = `qw_pk_inc_life_${Date.now()}`;
const INCIDENT_ID = `inc_lifecycle_${Date.now()}`;

const redis = new Redis({ host: 'localhost', port: 6379 });

async function main() {
  console.log('--- Incident Lifecycle Comprehensive Validation ---');

  // Seed project, key mapping, and SRE user
  await redis.set(`queuewatch:project_metadata:${PROJECT_ID}`, JSON.stringify({
    id: PROJECT_ID,
    name: 'Incident Lifecycle Test Project',
    apiKey: API_KEY,
    createdAt: Date.now(),
    hasReceivedTelemetry: true
  }));
  await redis.set(`queuewatch:api_keys:${API_KEY}`, JSON.stringify({
    projectId: PROJECT_ID,
    userId: 'demo_user_sre_910'
  }));
  await redis.sadd('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);

  // Authenticate to get JWT token
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

  // 1. Detection/Creation
  console.log('\n[STAGE 1] Creating a new incident...');
  const testIncident = {
    id: INCIDENT_ID,
    title: 'Out of Memory Crash on worker-payment-service',
    severity: 'critical',
    affectedQueue: 'payment_queue',
    status: 'open',
    firstDetectedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    summary: 'Worker payments crashed due to heap exhaustion.',
    evidence: 'Node.js process OOM exception.',
    suspectedRootCause: 'Memory leak in transaction parsing.',
    recommendation: 'Restart container nodes and rollback regression.',
    impact: 'Checkout transactions degraded.',
    relatedErrors: ['OOM Exception', 'Heap limit exceeded']
  };

  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, INCIDENT_ID, JSON.stringify(testIncident));

  // Log timeline event for incident opened
  await redis.rpush(`queuewatch:project:${PROJECT_ID}:incident_timeline:${INCIDENT_ID}`, JSON.stringify({
    event: 'failures.spiked',
    title: 'Incident Opened',
    desc: testIncident.summary,
    timestamp: Date.now()
  }));

  // Fetch to verify detection
  const getRes = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}`, { headers: authHeaders });
  if (!getRes.ok) throw new Error('FAIL: Incident not found');
  const fetchedIncident = await getRes.json();
  console.log('✓ Stage 1 Passed: Incident detected and queried');

  // 2. Acknowledgement
  console.log('\n[STAGE 2] Acknowledging incident...');
  const ackRes = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/acknowledge`, {
    method: 'PATCH',
    headers: authHeaders
  });
  if (!ackRes.ok) throw new Error(`FAIL: Ack endpoint returned ${ackRes.status}`);
  const ackedIncident = await ackRes.json();
  
  if (ackedIncident.status === 'acknowledged' && ackedIncident.assigneeId === 'demo_user_sre_910' && ackedIncident.acknowledgedAt) {
    console.log('✓ Stage 2 Passed: Incident acknowledged correctly with SRE user stamps');
  } else {
    throw new Error(`FAIL: Acknowledged incident stamps incorrect: ${JSON.stringify(ackedIncident)}`);
  }

  // 3. Investigation / Analysis
  console.log('\n[STAGE 3] Querying Socratic analysis...');
  const analysisRes = await fetch(`${ENDPOINT}/api/copilot/incident/${INCIDENT_ID}/chat`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ prompt: 'Analyze this incident and find root cause' })
  });
  if (!analysisRes.ok) throw new Error('FAIL: Analysis failed');
  const analysis = await analysisRes.json();
  if (analysis.investigationGraph && analysis.answer) {
    console.log('✓ Stage 3 Passed: Socratic analysis generated graph and answer');
  } else {
    throw new Error('FAIL: Analysis response incomplete');
  }

  // 4. Resolution & Postmortem Archiving
  console.log('\n[STAGE 4] Resolving incident & postmortem archive...');
  const resolveRes = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/resolve`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      summary: 'Resolved payment-service heap leak by wrapping transactions in try-catch and recycling processes.',
      feedback: {
        whatHappened: 'OOM in heap memory.',
        whatFixedIt: 'Recycled pods.',
        differentlyNextTime: 'Limit connection limits.'
      }
    })
  });
  if (!resolveRes.ok) throw new Error('FAIL: Resolution endpoint failed');
  const resolvedIncident = await resolveRes.json();

  if (resolvedIncident.status === 'resolved' && resolvedIncident.resolvedAt) {
    console.log('✓ Stage 4 Passed: Incident resolved successfully');
  } else {
    throw new Error('FAIL: Incident resolution state mismatch');
  }

  // Verify Knowledge Entry logged in Redis
  const knowledgeValues = await redis.hvals(`queuewatch:project:${PROJECT_ID}:knowledge_base`);
  if (knowledgeValues.length > 0) {
    const knowEntry = JSON.parse(knowledgeValues[0]);
    console.log('  Enriched SRE Knowledge Entry archived:', knowEntry.title);
    console.log('  ✓ Stage 4b Passed: Knowledge base correctly logs postmortem findings');
  } else {
    throw new Error('FAIL: No knowledge entry was created');
  }

  // 5. Timeline Verification
  console.log('\n[STAGE 5] Checking timeline events...');
  const timelineRes = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/timeline`, { headers: authHeaders });
  const timeline = await timelineRes.json();
  console.log('  Timeline events:', timeline.map(t => t.title));
  if (timeline.some(t => t.title.includes('Acknowledged')) && timeline.some(t => t.title.includes('Resolved'))) {
    console.log('✓ Stage 5 Passed: All states correctly append events to SRE Incident timeline');
  } else {
    throw new Error('FAIL: Timeline missing state events');
  }

  // Clean up
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  await redis.del(`queuewatch:project:${PROJECT_ID}:incidents`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:incident_timeline:${INCIDENT_ID}`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:knowledge_base`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:reliability_trends`);
  redis.disconnect();

  console.log('\n✓ SUCCESS: Incident Lifecycle Validation Completed.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Incident Lifecycle Validation Error:', err);
    process.exit(1);
  });
}
