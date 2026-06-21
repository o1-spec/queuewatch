const Redis = require('ioredis');

const ENDPOINT = 'http://localhost:3001';
const PROJECT_ID = `proj_dep_corr_${Date.now()}`;
const API_KEY = `qw_pk_dep_corr_${Date.now()}`;
const redis = new Redis({ host: 'localhost', port: 6379 });

async function main() {
  console.log('--- Deployment Correlation Comprehensive Validation ---');

  // Seed project, key mapping, SRE user
  await redis.set(`queuewatch:project_metadata:${PROJECT_ID}`, JSON.stringify({
    id: PROJECT_ID,
    name: 'Deployment Correlation Project',
    apiKey: API_KEY,
    createdAt: Date.now(),
    hasReceivedTelemetry: true
  }));
  await redis.set(`queuewatch:api_keys:${API_KEY}`, JSON.stringify({
    projectId: PROJECT_ID,
    userId: 'demo_user_sre_910'
  }));
  await redis.sadd('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);

  // Authenticate SRE user
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

  // Seed default queues, services, and dependency graphs
  const servicesKey = `queuewatch:project:${PROJECT_ID}:services`;
  const queueAService = {
    id: 'svc_queue_a',
    name: 'service-a',
    environment: 'production',
    queues: ['queue_a'],
    workers: ['worker_a'],
    createdAt: Date.now()
  };
  const queueBService = {
    id: 'svc_queue_b',
    name: 'service-b',
    environment: 'production',
    queues: ['queue_b'],
    workers: ['worker_b'],
    createdAt: Date.now()
  };
  await redis.hset(servicesKey, 'svc_queue_a', JSON.stringify(queueAService));
  await redis.hset(servicesKey, 'svc_queue_b', JSON.stringify(queueBService));

  // SCENARIO 1: Outage occurs 5 minutes after deployment (High correlation)
  console.log('\n[SCENARIO 1] Outage 5 minutes after deployment on queue_a...');
  const incidentTime1 = Date.now();
  const depTime1 = incidentTime1 - 5 * 60 * 1000; // 5 mins before

  const deployment1 = {
    id: 'dep_1',
    service: 'queue_a',
    version: 'v1.0.1',
    commitSha: 'commit111',
    branch: 'release/v1.0.1',
    environment: 'production',
    deployedBy: 'SRE Coordinator',
    deployedAt: depTime1
  };
  await redis.lpush(`queuewatch:project:${PROJECT_ID}:deployments`, JSON.stringify(deployment1));

  const incident1 = {
    id: 'inc_corr_1',
    title: 'High latency on queue_a',
    severity: 'high',
    affectedQueue: 'queue_a',
    status: 'open',
    firstDetectedAt: incidentTime1,
    lastUpdatedAt: incidentTime1,
    summary: 'Queue processing slowed down.'
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, 'inc_corr_1', JSON.stringify(incident1));

  // Query analysis for inc_corr_1
  let res1 = await fetch(`${ENDPOINT}/api/copilot/incident/inc_corr_1/chat`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ prompt: 'Analyze this incident' })
  });
  if (!res1.ok) throw new Error('Scenario 1 query failed');
  let analysis1 = await res1.json();
  
  let hasRegHyp1 = analysis1.hypotheses.some(h => h.title === 'Deployment Regression' && h.confidence >= 80);
  if (hasRegHyp1) {
    console.log('✓ Scenario 1 Passed: Outage correctly correlated with v1.0.1 deployment (High Confidence)');
  } else {
    throw new Error(`FAIL: Expected Deployment Regression hypothesis not found or low confidence: ${JSON.stringify(analysis1.hypotheses)}`);
  }

  // SCENARIO 2: Outage occurs 2 hours after deployment (No correlation)
  console.log('\n[SCENARIO 2] Outage 2 hours after deployment on queue_a...');
  const incidentTime2 = Date.now();
  const depTime2 = incidentTime2 - 120 * 60 * 1000; // 2 hours before

  const deployment2 = {
    id: 'dep_2',
    service: 'queue_a',
    version: 'v1.0.2',
    commitSha: 'commit222',
    branch: 'release/v1.0.2',
    environment: 'production',
    deployedBy: 'SRE Coordinator',
    deployedAt: depTime2
  };
  await redis.del(`queuewatch:project:${PROJECT_ID}:deployments`); // clear old
  await redis.lpush(`queuewatch:project:${PROJECT_ID}:deployments`, JSON.stringify(deployment2));

  const incident2 = {
    id: 'inc_corr_2',
    title: 'High latency on queue_a',
    severity: 'high',
    affectedQueue: 'queue_a',
    status: 'open',
    firstDetectedAt: incidentTime2,
    lastUpdatedAt: incidentTime2,
    summary: 'Queue processing slowed down.'
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, 'inc_corr_2', JSON.stringify(incident2));

  let res2 = await fetch(`${ENDPOINT}/api/copilot/incident/inc_corr_2/chat`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ prompt: 'Analyze this incident' })
  });
  let analysis2 = await res2.json();

  let hasRegHyp2 = analysis2.hypotheses.some(h => h.title === 'Deployment Regression');
  // Wait, if it has 0 correlation, the engine might either return 0 confidence, or omit the hypothesis
  const regHyp2 = analysis2.hypotheses.find(h => h.title === 'Deployment Regression');
  if (!regHyp2 || regHyp2.confidence < 20) {
    console.log('✓ Scenario 2 Passed: Distant deployment (2 hours ago) did not generate regression hypothesis (or had negligible confidence)');
  } else {
    throw new Error(`FAIL: Unexpected correlation hypothesis with high confidence for old release: ${JSON.stringify(regHyp2)}`);
  }

  // SCENARIO 3: Outage on queue_b, deployment on queue_a (No cross-queue correlation)
  console.log('\n[SCENARIO 3] Outage on queue_b, but recent deployment was on queue_a...');
  const incidentTime3 = Date.now();
  const depTime3 = incidentTime3 - 5 * 60 * 1000; // 5 mins before

  const deployment3 = {
    id: 'dep_3',
    service: 'queue_a', // deployed to queue_a
    version: 'v1.0.3',
    commitSha: 'commit333',
    branch: 'release/v1.0.3',
    environment: 'production',
    deployedBy: 'SRE Coordinator',
    deployedAt: depTime3
  };
  await redis.del(`queuewatch:project:${PROJECT_ID}:deployments`);
  await redis.lpush(`queuewatch:project:${PROJECT_ID}:deployments`, JSON.stringify(deployment3));

  const incident3 = {
    id: 'inc_corr_3',
    title: 'Failure spike on queue_b', // outage on queue_b
    severity: 'critical',
    affectedQueue: 'queue_b',
    status: 'open',
    firstDetectedAt: incidentTime3,
    lastUpdatedAt: incidentTime3,
    summary: 'Worker queue B crashed.'
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, 'inc_corr_3', JSON.stringify(incident3));

  let res3 = await fetch(`${ENDPOINT}/api/copilot/incident/inc_corr_3/chat`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ prompt: 'Analyze this incident' })
  });
  let analysis3 = await res3.json();

  let hasRegHyp3 = analysis3.hypotheses.some(h => h.title === 'Deployment Regression');
  const regHyp3 = analysis3.hypotheses.find(h => h.title === 'Deployment Regression');
  if (!regHyp3 || regHyp3.confidence < 20) {
    console.log('✓ Scenario 3 Passed: Outage on queue_b was isolated from queue_a deployment');
  } else {
    throw new Error(`FAIL: Outage on queue_b falsely correlated with queue_a deployment: ${JSON.stringify(regHyp3)}`);
  }

  // Clean up
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  await redis.del(`queuewatch:project:${PROJECT_ID}:deployments`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:incidents`);
  await redis.del(servicesKey);
  redis.disconnect();

  console.log('\n✓ SUCCESS: Deployment Correlation Validation Completed.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Deployment Correlation Error:', err);
    process.exit(1);
  });
}
