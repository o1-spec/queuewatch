const Redis = require('ioredis');
const ioClient = require('socket.io-client');

const ENDPOINT = 'http://localhost:3001';
const PROJECT_A = `proj_sec_a_${Date.now()}`;
const PROJECT_B = `proj_sec_b_${Date.now()}`;
const KEY_A = `qw_pk_sec_a_${Date.now()}`;
const KEY_B = `qw_pk_sec_b_${Date.now()}`;
const USER_A = `user_sec_a_${Date.now()}`;
const USER_B = `user_sec_b_${Date.now()}`;

const redis = new Redis({ host: 'localhost', port: 6379 });

async function main() {
  console.log('--- Security & Project Isolation Validation ---');

  // Register users, create projects, and API key maps
  console.log('  Registering SRE User A...');
  const regARes = await fetch(`${ENDPOINT}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'SRE Sec A', email: `${USER_A}@queuewatch.dev`, password: 'password123', company: 'Company A' })
  });
  const userAData = await regARes.json();
  const tokenA = userAData.token;

  console.log('  Registering SRE User B...');
  const regBRes = await fetch(`${ENDPOINT}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'SRE Sec B', email: `${USER_B}@queuewatch.dev`, password: 'password123', company: 'Company B' })
  });
  const userBData = await regBRes.json();
  const tokenB = userBData.token;

  // Link in Redis
  await redis.set(`queuewatch:project_metadata:${PROJECT_A}`, JSON.stringify({ id: PROJECT_A, name: 'Project A', apiKey: KEY_A, createdAt: Date.now(), hasReceivedTelemetry: true }));
  await redis.set(`queuewatch:api_keys:${KEY_A}`, JSON.stringify({ projectId: PROJECT_A, userId: userAData.user.id }));
  await redis.sadd(`queuewatch:user_projects:${userAData.user.id}`, PROJECT_A);

  await redis.set(`queuewatch:project_metadata:${PROJECT_B}`, JSON.stringify({ id: PROJECT_B, name: 'Project B', apiKey: KEY_B, createdAt: Date.now(), hasReceivedTelemetry: true }));
  await redis.set(`queuewatch:api_keys:${KEY_B}`, JSON.stringify({ projectId: PROJECT_B, userId: userBData.user.id }));
  await redis.sadd(`queuewatch:user_projects:${userBData.user.id}`, PROJECT_B);

  // Test 1: Accessing endpoints without Authorization header
  console.log('\n[TEST 1] Testing queries with missing Authorization token...');
  const res1 = await fetch(`${ENDPOINT}/api/incidents`, {
    headers: { 'Content-Type': 'application/json', 'x-project-id': PROJECT_A }
  });
  console.log('  Response Status:', res1.status);
  if (res1.status === 401) {
    console.log('  ✓ Correct: Blocked access (401 Unauthorized)');
  } else {
    throw new Error('FAIL: Allowed query without SRE token');
  }

  // Test 2: Accessing endpoints with invalid authorization token
  console.log('\n[TEST 2] Testing queries with invalid/expired token format...');
  const res2 = await fetch(`${ENDPOINT}/api/incidents`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer bad_expired_token_123',
      'x-project-id': PROJECT_A
    }
  });
  console.log('  Response Status:', res2.status);
  if (res2.status === 401) {
    console.log('  ✓ Correct: Blocked access (401 Unauthorized)');
  } else {
    throw new Error('FAIL: Allowed query with bad token format');
  }

  // Test 3: Cross-project boundary check (ProjectIsolationGuard)
  console.log('\n[TEST 3] Testing cross-project boundary access rules...');
  const res3 = await fetch(`${ENDPOINT}/api/incidents`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenA}`, // User A
      'x-project-id': PROJECT_B // Querying Project B
    }
  });
  console.log('  Response Status:', res3.status);
  if (res3.status === 403) {
    console.log('  ✓ Correct: Blocked User A from reading Project B data (403 Forbidden)');
  } else {
    throw new Error('FAIL: Allowed cross-project access without authorization');
  }

  // Test 4: Ingestion authentication via invalid API Key
  console.log('\n[TEST 4] Testing telemetry ingestion using invalid API key...');
  const res4 = await fetch(`${ENDPOINT}/api/ingest/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer bad_api_key_invalid'
    },
    body: JSON.stringify({
      projectId: PROJECT_A,
      events: [{ type: 'job.active', queueName: 'payment_queue' }]
    })
  });
  console.log('  Response Status:', res4.status);
  if (res4.status === 401) {
    console.log('  ✓ Correct: Ingestion blocked due to invalid API key mapping');
  } else {
    throw new Error('FAIL: Telemetry ingest allowed using invalid key');
  }

  // Test 5: WebSocket auth verification (Missing token)
  console.log('\n[TEST 5] Testing WebSocket connection with missing token...');
  const socket1 = ioClient(ENDPOINT, {
    transports: ['websocket'],
    query: { projectId: PROJECT_A },
    autoConnect: false
  });
  
  socket1.connect();
  const socket1Connected = await new Promise((resolve) => {
    socket1.on('connect', () => {
      socket1.disconnect();
      resolve(true);
    });
    socket1.on('connect_error', () => {
      socket1.disconnect();
      resolve(false);
    });
    setTimeout(() => {
      socket1.disconnect();
      resolve(false);
    }, 1500);
  });
  
  if (!socket1Connected) {
    console.log('  ✓ Correct: WebSocket connection refused due to missing SRE token');
  } else {
    throw new Error('FAIL: WebSocket connected without authentication credentials');
  }

  // Test 6: WebSocket auth verification (Unauthorized Project Room)
  console.log('\n[TEST 6] Testing WebSocket connection to unauthorized project room...');
  const socket2 = ioClient(ENDPOINT, {
    transports: ['websocket'],
    auth: { token: tokenA }, // User A
    query: { projectId: PROJECT_B }, // Querying Project B
    autoConnect: false
  });

  socket2.connect();
  const socket2Connected = await new Promise((resolve) => {
    socket2.on('connect', () => {
      socket2.disconnect();
      resolve(true);
    });
    socket2.on('connect_error', () => {
      socket2.disconnect();
      resolve(false);
    });
    setTimeout(() => {
      socket2.disconnect();
      resolve(false);
    }, 1500);
  });

  if (!socket2Connected) {
    console.log('  ✓ Correct: WebSocket connection refused for unauthorized project room');
  } else {
    throw new Error('FAIL: WebSocket connected to unauthorized project room');
  }

  // Test 7: WebSocket successful auth
  console.log('\n[TEST 7] Testing WebSocket connection with correct credentials and room ownership...');
  const socket3 = ioClient(ENDPOINT, {
    transports: ['websocket'],
    auth: { token: tokenA }, // User A
    query: { projectId: PROJECT_A }, // Project A
    autoConnect: false
  });

  socket3.connect();
  const socket3Connected = await new Promise((resolve) => {
    socket3.on('connect', () => {
      socket3.disconnect();
      resolve(true);
    });
    socket3.on('connect_error', (e) => {
      socket3.disconnect();
      resolve(false);
    });
    setTimeout(() => {
      socket3.disconnect();
      resolve(false);
    }, 2000);
  });

  if (socket3Connected) {
    console.log('  ✓ Correct: Authenticated SRE WebSocket connection established successfully');
  } else {
    throw new Error('FAIL: WebSocket failed to connect using valid credentials');
  }

  // Clean up
  await redis.del(`queuewatch:project_metadata:${PROJECT_A}`);
  await redis.del(`queuewatch:project_metadata:${PROJECT_B}`);
  await redis.del(`queuewatch:api_keys:${KEY_A}`);
  await redis.del(`queuewatch:api_keys:${KEY_B}`);
  await redis.del(`queuewatch:user_projects:${userAData.user.id}`);
  await redis.del(`queuewatch:user_projects:${userBData.user.id}`);
  await redis.del(`queuewatch:users:${userAData.user.id}`);
  await redis.del(`queuewatch:users:${userBData.user.id}`);
  await redis.hdel('queuewatch:user_registry', `${USER_A}@queuewatch.dev`);
  await redis.hdel('queuewatch:user_registry', `${USER_B}@queuewatch.dev`);
  redis.disconnect();

  console.log('\n✓ SUCCESS: Security Validation Completed.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Security Validation Error:', err);
    process.exit(1);
  });
}
