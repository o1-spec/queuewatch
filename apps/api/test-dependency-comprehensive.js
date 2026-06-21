const Redis = require('ioredis');

const ENDPOINT = 'http://localhost:3001';
const PROJECT_ID = `proj_dependency_${Date.now()}`;
const API_KEY = `qw_pk_dep_${Date.now()}`;
const INCIDENT_ID = `inc_dep_${Date.now()}`;

const redis = new Redis({ host: 'localhost', port: 6379 });

async function main() {
  console.log('--- Dependency Graph Validation ---');

  // Seed project
  await redis.set(`queuewatch:project_metadata:${PROJECT_ID}`, JSON.stringify({
    id: PROJECT_ID,
    name: 'Dependency Test Project',
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

  // Seed Services detail (business capability mapping)
  const servicesKey = `queuewatch:project:${PROJECT_ID}:services`;
  const services = {
    'svc_checkout': { id: 'svc_checkout', name: 'checkout-service', businessCapability: 'Customer Checkout', queues: ['checkout_queue'] },
    'svc_payment': { id: 'svc_payment', name: 'payment-service', businessCapability: 'Payment Processing', queues: ['payment_queue'] },
    'svc_invoice': { id: 'svc_invoice', name: 'invoice-service', businessCapability: 'Billing Invoices', queues: ['invoice_queue'] },
    'svc_notification': { id: 'svc_notification', name: 'notification-service', businessCapability: 'Email Notifications', queues: ['notification_queue'] }
  };
  for (const [id, service] of Object.entries(services)) {
    await redis.hset(servicesKey, id, JSON.stringify(service));
  }

  // Seed Dependency Graph: checkout-service ➔ payment_queue ➔ payment-service ➔ invoice-service ➔ notification-service
  const dgKey = `queuewatch:project:${PROJECT_ID}:dependency_graph`;
  const graph = {
    nodes: [
      { id: 'svc_checkout', label: 'checkout-service', type: 'service' },
      { id: 'payment_queue', label: 'payment_queue', type: 'queue' },
      { id: 'svc_payment', label: 'payment-service', type: 'service' },
      { id: 'svc_invoice', label: 'invoice-service', type: 'service' },
      { id: 'svc_notification', label: 'notification-service', type: 'service' }
    ],
    edges: [
      { from: 'svc_checkout', to: 'payment_queue', observations: 100 },
      { from: 'payment_queue', to: 'svc_payment', observations: 100 },
      { from: 'svc_payment', to: 'svc_invoice', observations: 100 },
      { from: 'svc_invoice', to: 'svc_notification', observations: 100 }
    ],
    serviceImpacts: {}
  };
  await redis.set(dgKey, JSON.stringify(graph));

  // Seed active incident affecting payment_queue (which maps to payment-service)
  const incident = {
    id: INCIDENT_ID,
    title: 'Postgres Connection pool saturated on payment_queue',
    severity: 'critical',
    affectedQueue: 'payment_queue',
    status: 'open',
    firstDetectedAt: Date.now()
  };
  await redis.hset(`queuewatch:project:${PROJECT_ID}:incidents`, INCIDENT_ID, JSON.stringify(incident));

  // 1. Discovery Validation
  console.log('\n[TEST 1] Querying global dependency graph...');
  const res1 = await fetch(`${ENDPOINT}/api/dependencies/graph`, { headers: authHeaders });
  const fetchedGraph = await res1.json();

  if (fetchedGraph.nodes.length === 5 && fetchedGraph.edges.length === 4) {
    console.log('✓ Test 1 Passed: Graph successfully discovered (all 5 nodes and 4 edges exist)');
  } else {
    throw new Error(`FAIL: Fetched graph incorrect: ${JSON.stringify(fetchedGraph)}`);
  }

  // 2. Blast Radius Validation
  console.log('\n[TEST 2] Verifying downstream blast radius calculations (BFS cascade)...');
  const res2 = await fetch(`${ENDPOINT}/api/incidents/${INCIDENT_ID}/blast-radius`, { headers: authHeaders });
  const blastRadius = await res2.json();

  console.log('  Trigger incident service:', blastRadius.affectedService?.name);
  console.log('  Downstream Blast Radius Cascade:', blastRadius.impactedServices);
  console.log('  Impacted Business Capabilities:', blastRadius.businessImpacts);

  // Since payment-service is affected, downstream dependencies from payment-service (checkout is upstream) are:
  // payment-service ➔ invoice-service ➔ notification-service
  // Let's assert downstream has invoice-service and notification-service
  const downNames = blastRadius.impactedServices;
  if (downNames.includes('invoice-service') && downNames.includes('notification-service')) {
    console.log('✓ Test 2 Passed: Blast radius BFS correctly identified downstream dependents invoice-service and notification-service');
  } else {
    throw new Error(`FAIL: BFS cascade failed to identify correct downstream nodes: ${JSON.stringify(downNames)}`);
  }

  // 3. Business Capability Mapping
  console.log('\n[TEST 3] Verifying Business Capability Mapping...');
  const capabilities = blastRadius.businessImpacts;
  if (capabilities.some(c => c.includes('Billing Invoices')) && capabilities.some(c => c.includes('Email Notifications'))) {
    console.log('✓ Test 3 Passed: Downstream capability mapping correct (Billing Invoices & Email Notifications)');
  } else {
    throw new Error(`FAIL: Business capabilities mapping failed: ${JSON.stringify(capabilities)}`);
  }

  // Clean up
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  await redis.del(`queuewatch:project:${PROJECT_ID}:incidents`);
  await redis.del(servicesKey);
  await redis.del(dgKey);
  redis.disconnect();

  console.log('\n✓ SUCCESS: Dependency Graph Validation Completed.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Dependency Graph Validation Error:', err);
    process.exit(1);
  });
}
