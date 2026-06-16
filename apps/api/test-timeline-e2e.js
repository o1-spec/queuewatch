const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

const PROJECT_ID = 'proj_test_123';
const API_KEY = 'qw_test_key_123';
const INCIDENT_ID = 'inc_test_123';
const ENDPOINT = 'http://localhost:3001';

async function main() {
  console.log('1. Seeding project, API key, user, and events in Redis...');

  const now = Date.now();
  const depTime = now - 5 * 60 * 1000;      // 5 min ago
  const errorTime = now - 4 * 60 * 1000;    // 4 min ago
  const incidentTime = now - 3 * 60 * 1000; // 3 min ago

  // Seed project metadata
  await redis.set(
    `queuewatch:project_metadata:${PROJECT_ID}`,
    JSON.stringify({
      id: PROJECT_ID,
      name: 'E2E Timeline Test Project',
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

  // Seed deployment (payment-service v1.4.8, branch feature/timeline)
  const depEvent = {
    id: 'dep_test_123',
    service: 'payment-service',
    version: 'v1.4.8',
    commitSha: 'commit12345678',
    branch: 'feature/timeline',
    environment: 'production',
    deployedBy: 'SRE E2E Operator',
    deployedAt: depTime,
  };
  await redis.lpush(`queuewatch:project:${PROJECT_ID}:deployments`, JSON.stringify(depEvent));

  // Seed telemetry error event (job.failed on payment_queue)
  const telemetryEvent = {
    id: 'tel_test_error_123',
    type: 'job.failed',
    queueName: 'payment_queue',
    serviceName: 'payment-service',
    jobId: 'job_pay_888',
    errorMessage: 'Stripe transaction timeout limit reached: Gateway Error 504',
    timestamp: errorTime,
  };
  await redis.lpush(`queuewatch:project:${PROJECT_ID}:telemetry`, JSON.stringify(telemetryEvent));

  // Seed alert notification
  const alertNotif = {
    id: 'notif_test_123',
    incidentId: INCIDENT_ID,
    message: '🔥 [ALERT] High Failure Rate on payment_queue exceeded target 10%',
    severity: 'critical',
    queueName: 'payment_queue',
    channel: 'email',
    status: 'sent',
    timestamp: incidentTime + 1000,
  };
  await redis.lpush(`queuewatch:project:${PROJECT_ID}:notifications`, JSON.stringify(alertNotif));

  // Seed incident in Redis
  const incidentObj = {
    id: INCIDENT_ID,
    title: 'High Failure Rate on payment_queue',
    severity: 'critical',
    affectedQueue: 'payment_queue',
    status: 'open',
    firstDetectedAt: incidentTime,
    lastUpdatedAt: incidentTime,
    summary: 'The job failure rate on queue payment_queue is currently 25%.',
    evidence: 'Failed jobs count: 12 out of 48 runs.',
    suspectedRootCause: 'Downstream dependency timeout.',
    recommendation: 'Check stripe API key settings.',
    impact: 'Customers cannot complete checkout transactions.',
    relatedErrors: ['Stripe transaction timeout limit reached'],
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, INCIDENT_ID, JSON.stringify(incidentObj));

  console.log('2. Logging in to get JWT token...');
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

  console.log('\n3. Testing GET timeline (dynamic build)...');
  const getTimelineRes = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/timeline`, {
    headers: authHeaders,
  });
  
  if (!getTimelineRes.ok) {
    throw new Error(`Get timeline failed: ${getTimelineRes.status}`);
  }

  const initialTimeline = await getTimelineRes.json();
  console.log('Chronological timeline events:');
  console.log(JSON.stringify(initialTimeline, null, 2));

  // Assertions for initial timeline
  const events = initialTimeline.map(e => e.event);
  console.log('\nVerifying initial timeline events...');
  console.log('Includes deployment:', events.includes('deployment'));
  console.log('Includes first error:', events.includes('first.error'));
  console.log('Includes failure spike:', events.includes('failures.spiked'));
  console.log('Includes alert.sent:', events.includes('alert.sent'));

  const depEventItem = initialTimeline.find(e => e.event === 'deployment');
  if (depEventItem && depEventItem.metadata && depEventItem.metadata.correlation) {
    console.log('Confidence level:', depEventItem.metadata.correlation.confidence);
    console.log('Confidence label:', depEventItem.metadata.correlation.label);
    console.log('Correlation description:', depEventItem.desc);
    if (depEventItem.metadata.correlation.confidence !== 'strong') {
      console.error('FAIL: Expected strong correlation confidence!');
    }
  } else {
    console.error('FAIL: Missing deployment correlation metadata!');
  }

  console.log('\n4. Acknowledging incident...');
  const ackRes = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/acknowledge`, {
    method: 'PATCH',
    headers: authHeaders,
  });
  console.log('Acknowledge Status:', ackRes.status);

  console.log('\n5. Re-fetching timeline (should contain acknowledge event)...');
  const getTimelineRes2 = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/timeline`, {
    headers: authHeaders,
  });
  const updatedTimeline = await getTimelineRes2.json();
  const updatedEvents = updatedTimeline.map(e => e.event);
  console.log('Includes Acknowledge:', updatedEvents.includes('incident.acknowledged'));

  console.log('\n6. Resolving incident...');
  const resolveRes = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/resolve`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({ summary: 'Resolved E2E: payment database connection pool was successfully recycled.' }),
  });
  console.log('Resolve Status:', resolveRes.status);

  console.log('\n7. Checking timeline persistence snapshot in Redis...');
  const finalTimelineRes = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/timeline`, {
    headers: authHeaders,
  });
  const finalTimeline = await finalTimelineRes.json();
  const finalEvents = finalTimeline.map(e => e.event);
  console.log('Includes Resolved event:', finalEvents.includes('incident.resolved'));

  const timelineKey = `queuewatch:project:${PROJECT_ID}:incident:${INCIDENT_ID}:timeline`;
  const rawTimeline = await redis.get(timelineKey);
  if (rawTimeline) {
    const parsed = JSON.parse(rawTimeline);
    console.log(`✓ SUCCESS: Persistent timeline snapshot found in Redis (${parsed.length} events).`);
  } else {
    console.error('FAIL: No persistent timeline snapshot found in Redis!');
  }

  console.log('\n8. Cleaning up E2E test keys...');
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:deployments`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:telemetry`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:notifications`);
  await redis.hdel(`queuewatch:project:${PROJECT_ID}:incidents`, INCIDENT_ID);
  await redis.del(timelineKey);
  await redis.del(`queuewatch:project:${PROJECT_ID}:investigations:${INCIDENT_ID}`);

  console.log('Done.');
  redis.disconnect();
}

main().catch(err => {
  console.error('E2E Test Error:', err);
  redis.disconnect();
});
