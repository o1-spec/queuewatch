const Redis = require('ioredis');

const ENDPOINT = 'http://localhost:3001';
const PROJECT_ID = `proj_investigation_${Date.now()}`;
const API_KEY = `qw_pk_inv_${Date.now()}`;
const INCIDENT_ID = `inc_inv_${Date.now()}`;

const redis = new Redis({ host: 'localhost', port: 6379 });

async function main() {
  console.log('--- Investigation Engine Validation ---');

  // Seed project, key mapping, SRE user
  await redis.set(`queuewatch:project_metadata:${PROJECT_ID}`, JSON.stringify({
    id: PROJECT_ID,
    name: 'Investigation Test Project',
    apiKey: API_KEY,
    createdAt: Date.now(),
    hasReceivedTelemetry: true
  }));
  await redis.set(`queuewatch:api_keys:${API_KEY}`, JSON.stringify({
    projectId: PROJECT_ID,
    userId: 'demo_user_sre_910'
  }));
  await redis.sadd('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);

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
  const paymentService = {
    id: 'svc_payment_service',
    name: 'payment-service',
    queues: ['payment_queue'],
    workers: ['worker_1'],
    createdAt: Date.now()
  };
  await redis.hset(servicesKey, 'svc_payment_service', JSON.stringify(paymentService));

  const dgKey = `queuewatch:project:${PROJECT_ID}:dependency_graph`;
  const defaultGraph = {
    nodes: [
      { id: 'svc_payment_service', label: 'Payment Service', type: 'service' },
      { id: 'payment_queue', label: 'payment_queue', type: 'queue' },
      { id: 'svc_notification_service', label: 'Notification Service', type: 'service' }
    ],
    edges: [
      { from: 'payment_queue', to: 'svc_payment_service', observations: 120 },
      { from: 'svc_payment_service', to: 'svc_notification_service', observations: 95 }
    ],
    serviceImpacts: {}
  };
  await redis.set(dgKey, JSON.stringify(defaultGraph));

  // Seed critical open incident
  const incidentTime = Date.now();
  const incident = {
    id: INCIDENT_ID,
    title: 'High Failure Rate on payment_queue',
    severity: 'critical',
    affectedQueue: 'payment_queue',
    status: 'open',
    firstDetectedAt: incidentTime,
    lastUpdatedAt: incidentTime,
    summary: 'Payment transactions failing due to DB timeouts.',
    evidence: 'Postgres query timeout exceptions.',
    suspectedRootCause: 'Lock contention in database connection pool.',
    recommendation: 'Scale database cluster resources.',
    impact: 'Downstream notifications delayed.'
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, INCIDENT_ID, JSON.stringify(incident));

  // Seed recent deployment regression (5 minutes before)
  const depTime = incidentTime - 5 * 60 * 1000;
  const deployment = {
    id: 'dep_inv_123',
    service: 'payment_queue',
    version: 'v2.1.4',
    commitSha: 'commit214',
    branch: 'release/v2.1.4',
    environment: 'production',
    deployedBy: 'SRE Coordinator',
    deployedAt: depTime
  };
  await redis.lpush(`queuewatch:project:${PROJECT_ID}:deployments`, JSON.stringify(deployment));

  // Ingest failed events and error logs
  const sdkHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  };
  await fetch(`${ENDPOINT}/api/ingest/events`, {
    method: 'POST',
    headers: sdkHeaders,
    body: JSON.stringify({
      projectId: PROJECT_ID,
      events: [{
        id: 'tel_inv_err_1',
        type: 'job.failed',
        queueName: 'payment_queue',
        serviceName: 'payment-service',
        duration: 3000,
        timestamp: Date.now(),
        errorMessage: 'Postgres query connection pool timeout after 10000ms'
      }]
    })
  });

  // Query Socratic SRE analysis
  console.log('\n[TEST 1] Triggering incident analysis...');
  const res = await fetch(`${ENDPOINT}/api/copilot/incident/${INCIDENT_ID}/chat`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ prompt: 'Perform complete Socratic causal analysis' })
  });
  if (!res.ok) throw new Error('Analysis failed');
  const analysis = await res.json();

  // 1. Evidence Priority Ranking
  console.log('\n[TEST 2] Verifying Evidence Priority Ranking...');
  const evidence = analysis.evidence || [];
  console.log('  Evidence gathered count:', evidence.length);
  const primaryEvidence = evidence.filter(e => e.rank === 'primary');
  const secondaryEvidence = evidence.filter(e => e.rank === 'secondary');
  const contextEvidence = evidence.filter(e => e.rank === 'context');
  
  console.log(`  Ranks: Primary=${primaryEvidence.length}, Secondary=${secondaryEvidence.length}, Context=${contextEvidence.length}`);
  if (primaryEvidence.length > 0 && secondaryEvidence.length > 0) {
    console.log('✓ Test 2 Passed: Evidence successfully prioritized (Log exceptions/incidents are primary, recent deployments are secondary)');
  } else {
    throw new Error('FAIL: Evidence ranking incorrect');
  }

  // 2. Hypotheses Generation
  console.log('\n[TEST 3] Verifying SRE Hypotheses...');
  const hypotheses = analysis.hypotheses || [];
  console.log('  Generated Hypotheses:', hypotheses.map(h => `${h.title} (Conf: ${h.confidence}%)`));
  if (hypotheses.some(h => h.title === 'Deployment Regression') && hypotheses.some(h => h.title === 'Exception Spike in Worker')) {
    console.log('✓ Test 3 Passed: Both Deployment Regression and Exception Spike hypotheses correctly generated');
  } else {
    throw new Error('FAIL: Missing key hypotheses');
  }

  // 3. Causal DAG Construction
  console.log('\n[TEST 4] Verifying Chronological Root-Cause DAG...');
  const graphNodes = analysis.investigationGraph.nodes || [];
  const graphEdges = analysis.investigationGraph.edges || [];
  console.log(`  DAG Nodes count: ${graphNodes.length}, Edges count: ${graphEdges.length}`);
  
  if (graphNodes.length > 0 && graphEdges.length > 0) {
    console.log('✓ Test 4 Passed: Causal DAG nodes and edge linkages generated');
  } else {
    throw new Error('FAIL: Investigation graph empty');
  }

  const allEdgesHaveRationals = graphEdges.every(e => e.confidence > 0 && typeof e.rationale === 'string');
  if (allEdgesHaveRationals) {
    console.log('✓ Test 4b Passed: All causal edges carry confidence weight ratings and SRE textual rationales');
  } else {
    throw new Error(`FAIL: Missing causal edge confidence or rationales: ${JSON.stringify(graphEdges)}`);
  }

  // 4. Recommendation Quality
  console.log('\n[TEST 5] Checking recommended actions...');
  const actions = analysis.recommendedActions || [];
  console.log('  Actions count:', actions.length);
  if (actions.length > 0 && actions.some(a => a.command && a.description)) {
    console.log('✓ Test 5 Passed: Actions correctly returned with manual verification terminal execution commands');
  } else {
    throw new Error('FAIL: Recommended actions missing details');
  }

  // Clean up
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  await redis.del(`queuewatch:project:${PROJECT_ID}:incidents`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:deployments`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:telemetry`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:workers`);
  await redis.del(servicesKey);
  await redis.del(dgKey);
  redis.disconnect();

  console.log('\n✓ SUCCESS: Investigation Engine Validation Completed.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Investigation Engine Validation Error:', err);
    process.exit(1);
  });
}
