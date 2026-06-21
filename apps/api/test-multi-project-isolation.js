const Redis = require('ioredis');

const ENDPOINT = 'http://localhost:3001';
const PROJECT_A = `proj_multi_a_${Date.now()}`;
const PROJECT_B = `proj_multi_b_${Date.now()}`;

const KEY_A = `qw_pk_multi_a_${Date.now()}`;
const KEY_B = `qw_pk_multi_b_${Date.now()}`;

const USER_A = `user_multi_a_${Date.now()}`;
const USER_B = `user_multi_b_${Date.now()}`;

const redis = new Redis({ host: 'localhost', port: 6379 });

async function main() {
  console.log('--- Multi-Project Tenant Isolation Validation ---');

  // 1. Seed two distinct users, projects, and API keys
  console.log('[STAGE 1] Seeding Project A (User A) and Project B (User B) in Redis...');

  await redis.set(`queuewatch:project_metadata:${PROJECT_A}`, JSON.stringify({ id: PROJECT_A, name: 'Project A', apiKey: KEY_A, createdAt: Date.now(), hasReceivedTelemetry: true }));
  await redis.set(`queuewatch:api_keys:${KEY_A}`, JSON.stringify({ projectId: PROJECT_A, userId: USER_A }));
  await redis.sadd(`queuewatch:user_projects:${USER_A}`, PROJECT_A);

  await redis.set(`queuewatch:project_metadata:${PROJECT_B}`, JSON.stringify({ id: PROJECT_B, name: 'Project B', apiKey: KEY_B, createdAt: Date.now(), hasReceivedTelemetry: true }));
  await redis.set(`queuewatch:api_keys:${KEY_B}`, JSON.stringify({ projectId: PROJECT_B, userId: USER_B }));
  await redis.sadd(`queuewatch:user_projects:${USER_B}`, PROJECT_B);

  // Register demo credentials to generate tokens
  // We'll create custom tokens using login, or since we have a test suite, we can use the login endpoint.
  // Wait, does the auth controller support custom user registrations?
  // Yes! POST /api/auth/register creates a user. Let's register User A and User B.
  console.log('  Registering SRE User A...');
  const regARes = await fetch(`${ENDPOINT}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'SRE User A', email: `${USER_A}@queuewatch.dev`, password: 'password123', company: 'Company A' })
  });
  if (!regARes.ok) throw new Error('Failed to register SRE A');
  const userAData = await regARes.json();
  const tokenA = userAData.token;

  console.log('  Registering SRE User B...');
  const regBRes = await fetch(`${ENDPOINT}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'SRE User B', email: `${USER_B}@queuewatch.dev`, password: 'password123', company: 'Company B' })
  });
  if (!regBRes.ok) throw new Error('Failed to register SRE B');
  const userBData = await regBRes.json();
  const tokenB = userBData.token;

  // Manually link the projects in Redis for these registered user IDs
  await redis.sadd(`queuewatch:user_projects:${userAData.user.id}`, PROJECT_A);
  await redis.sadd(`queuewatch:user_projects:${userBData.user.id}`, PROJECT_B);

  // Link key mapping to actual user ID
  await redis.set(`queuewatch:api_keys:${KEY_A}`, JSON.stringify({ projectId: PROJECT_A, userId: userAData.user.id }));
  await redis.set(`queuewatch:api_keys:${KEY_B}`, JSON.stringify({ projectId: PROJECT_B, userId: userBData.user.id }));

  // Seed distinct incidents for each project
  const incA = { id: 'inc_a_123', title: 'Error spike on Project A', affectedQueue: 'q_a', status: 'open' };
  const incB = { id: 'inc_b_123', title: 'Error spike on Project B', affectedQueue: 'q_b', status: 'open' };
  await redis.hset(`queuewatch:project:${PROJECT_A}:incidents`, 'inc_a_123', JSON.stringify(incA));
  await redis.hset(`queuewatch:project:${PROJECT_B}:incidents`, 'inc_b_123', JSON.stringify(incB));

  // 2. Verify Cross-Project Read Block (Project Isolation)
  console.log('\n[STAGE 2] Verifying User B cannot query Project A data...');
  const headersUserB_QueryA = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${tokenB}`,
    'x-project-id': PROJECT_A // Querying Project A
  };

  const resRead = await fetch(`${ENDPOINT}/api/incidents`, { headers: headersUserB_QueryA });
  console.log(`  Query Response Status: ${resRead.status}`);
  if (resRead.status === 403) {
    console.log('✓ Stage 2 Passed: Project isolation guard blocked unauthorized cross-project reads (403 Forbidden)');
  } else {
    throw new Error(`FAIL: Unauthorized project read allowed with status ${resRead.status}`);
  }

  // 3. Verify Cross-Project Deletion Block
  console.log('\n[STAGE 3] Verifying User B cannot delete Project A...');
  const deleteRes = await fetch(`${ENDPOINT}/api/projects/${PROJECT_A}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}` // User B trying to delete Project A
    }
  });

  console.log(`  Delete Response Status: ${deleteRes.status}`);
  if (deleteRes.status === 400 || deleteRes.status === 403) {
    console.log('✓ Stage 3 Passed: User B was blocked from deleting Project A');
  } else {
    throw new Error(`FAIL: Cross-project deletion succeeded with status ${deleteRes.status}`);
  }

  // Verify Project A still exists in Redis
  const metadataA = await redis.get(`queuewatch:project_metadata:${PROJECT_A}`);
  if (metadataA) {
    console.log('  ✓ Stage 3b Passed: Project A metadata remains fully intact and untouched');
  } else {
    throw new Error('FAIL: Project A metadata was deleted by User B');
  }

  // Clean up users and projects
  await redis.del(`queuewatch:project_metadata:${PROJECT_A}`);
  await redis.del(`queuewatch:project_metadata:${PROJECT_B}`);
  await redis.del(`queuewatch:api_keys:${KEY_A}`);
  await redis.del(`queuewatch:api_keys:${KEY_B}`);
  await redis.del(`queuewatch:user_projects:${userAData.user.id}`);
  await redis.del(`queuewatch:user_projects:${userBData.user.id}`);
  await redis.del(`queuewatch:project:${PROJECT_A}:incidents`);
  await redis.del(`queuewatch:project:${PROJECT_B}:incidents`);
  
  // Remove user profiles from Redis
  await redis.del(`queuewatch:users:${userAData.user.id}`);
  await redis.del(`queuewatch:users:${userBData.user.id}`);
  await redis.hdel('queuewatch:user_registry', `${USER_A}@queuewatch.dev`);
  await redis.hdel('queuewatch:user_registry', `${USER_B}@queuewatch.dev`);
  redis.disconnect();

  console.log('\n✓ SUCCESS: Multi-Project Tenant Isolation Validation Completed.');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Multi-Project Isolation Error:', err);
    process.exit(1);
  });
}
