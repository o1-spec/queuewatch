const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

const PROJECT_ID = 'proj_test_blast';
const API_KEY = 'qw_test_key_blast';
const INCIDENT_ID = 'inc_test_blast';
const ENDPOINT = 'http://localhost:3001';

async function main() {
  console.log('1. Seeding project, API key, and user in Redis...');

  // Seed project metadata
  await redis.set(
    `queuewatch:project_metadata:${PROJECT_ID}`,
    JSON.stringify({
      id: PROJECT_ID,
      name: 'E2E Blast Radius Test Project',
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

  // Seed Service Metadata (businessCapability, description, etc.)
  const servicesKey = `queuewatch:project:${PROJECT_ID}:services`;
  const defaultServices = [
    {
      id: 'svc_checkout_service',
      name: 'checkout-service',
      description: 'Ingests checkouts.',
      environment: 'production',
      owner: 'checkout-team',
      status: 'healthy',
      createdAt: Date.now(),
      queues: [],
      workers: [],
      deployments: [],
      incidents: [],
      businessCapability: 'Customer Checkout'
    },
    {
      id: 'svc_payment_service',
      name: 'payment-service',
      description: 'Stripe payments.',
      environment: 'production',
      owner: 'finance-team',
      status: 'healthy',
      createdAt: Date.now(),
      queues: ['payment_queue'],
      workers: ['payment_queue'],
      deployments: [],
      incidents: [],
      businessCapability: 'Customer Payments'
    },
    {
      id: 'svc_invoice_service',
      name: 'invoice-service',
      description: 'Billing invoice generator.',
      environment: 'production',
      owner: 'billing-team',
      status: 'healthy',
      createdAt: Date.now(),
      queues: ['invoice_queue'],
      workers: ['invoice_queue'],
      deployments: [],
      incidents: [],
      businessCapability: 'Billing Invoices'
    }
  ];
  for (const svc of defaultServices) {
    await redis.hset(servicesKey, svc.id, JSON.stringify(svc));
  }

  console.log('2. Ingesting SDK events to build dependency graph topology...');

  // SDK events headers
  const sdkHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  // 1. Ingest Checkout enqueuing Payment Queue (Producer edge: checkout-service -> payment_queue)
  // Send multiple times to verify edge observations counter
  for (let i = 0; i < 8; i++) {
    const res = await fetch(`${ENDPOINT}/api/ingest/events`, {
      method: 'POST',
      headers: sdkHeaders,
      body: JSON.stringify({
        projectId: PROJECT_ID,
        events: [{
          id: `tel_p_${i}`,
          type: 'job.created',
          queueName: 'payment_queue',
          serviceName: 'checkout-service',
          timestamp: Date.now(),
        }]
      })
    });
    if (!res.ok) throw new Error(`Failed to ingest producer event: ${res.status}`);
  }

  // 2. Ingest Payment Service consuming from Payment Queue (Consumer edge: payment_queue -> payment-service)
  // Send 60 times to make it a Strong dependency (50+ observations)
  for (let i = 0; i < 60; i++) {
    await fetch(`${ENDPOINT}/api/ingest/events`, {
      method: 'POST',
      headers: sdkHeaders,
      body: JSON.stringify({
        projectId: PROJECT_ID,
        events: [{
          id: `tel_c_${i}`,
          type: 'job.active',
          queueName: 'payment_queue',
          serviceName: 'payment-service',
          timestamp: Date.now(),
        }]
      })
    });
  }

  // 3. Ingest Payment Service enqueuing to Invoice Queue (Producer edge: payment-service -> invoice_queue)
  await fetch(`${ENDPOINT}/api/ingest/events`, {
    method: 'POST',
    headers: sdkHeaders,
    body: JSON.stringify({
      projectId: PROJECT_ID,
      events: [{
        id: 'tel_pi_1',
        type: 'job.created',
        queueName: 'invoice_queue',
        serviceName: 'payment-service',
        timestamp: Date.now(),
      }]
    })
  });

  // 4. Ingest Invoice Service consuming from Invoice Queue (Consumer edge: invoice_queue -> invoice-service)
  await fetch(`${ENDPOINT}/api/ingest/events`, {
    method: 'POST',
    headers: sdkHeaders,
    body: JSON.stringify({
      projectId: PROJECT_ID,
      events: [{
        id: 'tel_ii_1',
        type: 'job.active',
        queueName: 'invoice_queue',
        serviceName: 'invoice-service',
        timestamp: Date.now(),
      }]
    })
  });

  // 5. Ingest workflow step tracking dynamic service-to-service mapping (checkout-service -> payment-service)
  await fetch(`${ENDPOINT}/api/ingest/events`, {
    method: 'POST',
    headers: sdkHeaders,
    body: JSON.stringify({
      projectId: PROJECT_ID,
      events: [{
        id: 'tel_wf_1',
        type: 'workflow.step',
        step: 'checkout-service',
        nextStep: 'payment-service',
        timestamp: Date.now(),
      }]
    })
  });

  console.log('3. Logging in to get JWT token for SRE dashboard APIs...');
  const loginRes = await fetch(`${ENDPOINT}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'demo@queuewatch.dev',
      password: 'password123',
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status}`);
  }

  const { token } = await loginRes.json();
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'x-project-id': PROJECT_ID,
  };

  console.log('4. Fetching generated dependency graph topology...');
  const graphRes = await fetch(`${ENDPOINT}/api/dependencies/graph`, {
    headers: authHeaders,
  });
  if (!graphRes.ok) throw new Error(`Failed to fetch graph: ${graphRes.status}`);
  const graph = await graphRes.json();
  
  console.log('\n--- Discovered Topology Graph ---');
  console.log('Nodes:', graph.nodes);
  console.log('Edges with Observations:', graph.edges);

  // Assertions
  const checkToPayEdge = graph.edges.find(e => e.from === 'svc_checkout_service' && e.to === 'payment_queue');
  if (checkToPayEdge && checkToPayEdge.observations === 8) {
    console.log('✓ SUCCESS: Discovered checkout-service -> payment_queue edge with 8 observations.');
  } else {
    console.error('FAIL: checkout-service -> payment_queue edge not found or incorrect observations count:', checkToPayEdge);
  }

  const payToWfEdge = graph.edges.find(e => e.from === 'svc_checkout_service' && e.to === 'svc_payment_service');
  if (payToWfEdge) {
    console.log('✓ SUCCESS: Discovered workflow service-to-service edge checkout-service -> payment-service.');
  } else {
    console.error('FAIL: checkout-service -> payment-service workflow edge not found!');
  }

  console.log('5. Seeding test incident on payment_queue...');
  const incidentObj = {
    id: INCIDENT_ID,
    title: 'Outage on payment_queue',
    severity: 'high',
    affectedQueue: 'payment_queue',
    status: 'open',
    firstDetectedAt: Date.now(),
    lastUpdatedAt: Date.now(),
    summary: 'Testing blast radius cascade.',
    evidence: 'Queue errors spike.',
    suspectedRootCause: 'None.',
    recommendation: 'Check graph.',
    impact: 'Unknown.',
    relatedErrors: [],
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, INCIDENT_ID, JSON.stringify(incidentObj));

  console.log('6. Calculating blast radius cascade and business impacts...');
  const blastRes = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/blast-radius`, {
    headers: authHeaders,
  });
  if (!blastRes.ok) throw new Error(`Failed to fetch blast radius: ${blastRes.status}`);
  const blast = await blastRes.json();

  console.log('\n--- Calculated SRE Blast Radius Response ---');
  console.log(JSON.stringify(blast, null, 2));

  // Assertions
  if (blast.affectedService && blast.affectedService.name === 'payment-service') {
    console.log('✓ SUCCESS: Affected service correctly identified as payment-service.');
  } else {
    console.error('FAIL: Affected service is incorrect:', blast.affectedService);
  }

  if (blast.businessImpacts.includes('Customer Payments degraded') && blast.businessImpacts.includes('Billing Invoices degraded')) {
    console.log('✓ SUCCESS: Metadata-driven business capability mappings correctly resolved.');
  } else {
    console.error('FAIL: Business capability mapping failed:', blast.businessImpacts);
  }

  const strongEdge = blast.edges.find(e => e.from === 'payment_queue' && e.to === 'svc_payment_service');
  if (strongEdge && strongEdge.confidence === 'Strong') {
    console.log('✓ SUCCESS: payment_queue -> payment-service edge confidence correctly resolved as Strong.');
  } else {
    console.error('FAIL: Strong edge confidence mapping failed:', strongEdge);
  }

  console.log('\n7. Cleaning up test keys...');
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.del(servicesKey);
  await redis.del(`queuewatch:project:${PROJECT_ID}:dependency_graph`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:telemetry`);
  await redis.hdel(`queuewatch:project:${PROJECT_ID}:incidents`, INCIDENT_ID);

  console.log('Done.');
  redis.disconnect();
}

main().catch(err => {
  console.error('E2E Test Error:', err);
  redis.disconnect();
});
