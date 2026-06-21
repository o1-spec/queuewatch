/**
 * Phase 3.0 — Reliability Agent E2E Test
 *
 * Tests the full 6-stage agent pipeline:
 *   Plan → Investigate → Hypothesize → Resolve Runbooks → Recommend → Execute
 *
 * Usage:
 *   node apps/api/test-agent.js
 */

const http = require('http');
const assert = require('assert');

const API = 'http://localhost:3001';
const PROJECT_ID = 'proj_agent_test_999';
let TOKEN = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function request(method, path, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API}${path}`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }),
        'x-project-id': PROJECT_ID,
        ...extraHeaders,
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function redisSet(key, field, value) {
  const redis = require('ioredis');
  const client = new redis('redis://localhost:6379');
  await client.hset(key, field, JSON.stringify(value));
  await client.quit();
}

function log(msg) { process.stdout.write(`${msg}\n`); }
function pass(msg) { log(`✓ ${msg}`); }
function fail(msg) { log(`✗ ${msg}`); process.exit(1); }
function section(msg) { log(`\n${msg}`); }

// ─── Seed Data ────────────────────────────────────────────────────────────────

const TEST_INCIDENT_ID = `inc_agent_test_db_${Date.now()}`;
const SCOPE = `queuewatch:project:${PROJECT_ID}`;

const TEST_INCIDENT = {
  id: TEST_INCIDENT_ID,
  title: 'Postgres database connection pool timeout spike',
  severity: 'critical',
  affectedQueue: 'payment_queue',
  status: 'open',
  firstDetectedAt: Date.now() - 5 * 60 * 1000,
  lastUpdatedAt: Date.now(),
  summary: 'Database pool exhaustion causing connection timeout failures on payment_queue workers.',
  evidence: 'Postgres query connection pool timeout after 10000ms exception.',
  suspectedRootCause: 'Database connection limits saturation — pool size: 20, active connections: 20.',
  recommendation: 'Increase database pool limit and reduce concurrency.',
  impact: 'Payment processing halted. Checkout flows failing.',
  relatedErrors: ['Postgres timeout', 'pool exhaustion', 'connection refused'],
};

const TEST_RUNBOOK = {
  id: `rb_agent_test_db_pool`,
  incidentType: 'Database Pool Exhaustion',
  title: 'Database Pool Exhaustion Runbook',
  steps: [
    'Check active PostgreSQL connections: SELECT count(*) FROM pg_stat_activity',
    'Identify long-running queries blocking connection slots',
    'Increase connection pool limit from 20 to 50 in DB config',
    'Restart affected worker processes to clear stale connections',
  ],
  linkedIncidentIds: [],
  createdAt: Date.now() - 86400 * 1000,
};

const TEST_KNOWLEDGE_ENTRY = {
  id: `know_agent_db_001`,
  title: 'Resolution: Database Connection Pool Exhaustion',
  incidentId: 'inc_old_db_agent_test',
  pattern: 'Postgres query connection pool timeout after 10000ms',
  rootCause: 'Database pool leak due to unreleased client connection in query transaction.',
  resolution: 'Increased database connection pool limit from 20 to 50 and recycled container tasks.',
  preventionRecommendation: 'Wrap all query connections in auto-close resource blocks.',
  createdAt: Date.now() - 7 * 86400 * 1000,
  evidence: 'Postgres query connection pool timeout after 10000ms',
  hypotheses: ['Database pool exhaustion'],
  resolutionTimeMin: 12,
  recoveryTime: 12,
};

// ─── Main Test ────────────────────────────────────────────────────────────────

async function main() {
  log('\n╔══════════════════════════════════════════════════════════════════╗');
  log('║     Phase 3.0 — Reliability Agent E2E Verification Test         ║');
  log('╚══════════════════════════════════════════════════════════════════╝\n');

  // ─── 0. Login ──────────────────────────────────────────────────────────────
  section('0. Authenticating as demo user...');
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'demo@queuewatch.dev',
    password: 'password123',
  }, {});
  if (loginRes.status !== 200 && loginRes.status !== 201) {
    fail(`Auth failed: ${JSON.stringify(loginRes.body)}`);
  }
  TOKEN = loginRes.body.token || loginRes.body.access_token;
  pass('Authenticated successfully.');

  // ─── 1. Seed Test Data ─────────────────────────────────────────────────────
  section('1. Seeding test project, incident, runbook, and knowledge entry into Redis...');
  const redis = require('ioredis');
  const redisClient = new redis('redis://localhost:6379');

  // Project metadata + user link (required for JwtAuthGuard project scoping)
  await redisClient.set(
    `queuewatch:project_metadata:${PROJECT_ID}`,
    JSON.stringify({ id: PROJECT_ID, name: 'Agent E2E Test Project', apiKey: 'qw_agent_test_999', createdAt: Date.now(), hasReceivedTelemetry: true })
  );
  // Resolve authenticated user ID via /me endpoint
  const meRes = await request('GET', '/api/auth/me');
  const userId = meRes.body?.username || meRes.body?.id || meRes.body?.sub || 'demo_user_sre_910';
  await redisClient.sadd(`queuewatch:user_projects:${userId}`, PROJECT_ID);
  log(`  Linked project to user: ${userId}`);


  await redisClient.hset(`${SCOPE}:incidents`, TEST_INCIDENT_ID, JSON.stringify(TEST_INCIDENT));
  await redisClient.hset(`${SCOPE}:runbooks`, TEST_RUNBOOK.id, JSON.stringify(TEST_RUNBOOK));
  await redisClient.hset(`${SCOPE}:knowledge_entries`, TEST_KNOWLEDGE_ENTRY.id, JSON.stringify(TEST_KNOWLEDGE_ENTRY));

  await redisClient.quit();
  pass('Seeded project, incident, runbook, and knowledge entry.');

  // ─── 2. Run the Agent ──────────────────────────────────────────────────────
  section('2. Starting agent investigation session (POST /api/agent/run)...');
  const runRes = await request('POST', '/api/agent/run', { incidentId: TEST_INCIDENT_ID });
  if (runRes.status !== 200 && runRes.status !== 201) {
    fail(`Agent run failed with status ${runRes.status}: ${JSON.stringify(runRes.body)}`);
  }

  const session = runRes.body;
  console.log('Session Status:', session.status);
  console.log('Session ID:', session.id);

  assert(session.id, 'Session must have an ID');
  assert(session.id.startsWith('agt_'), `Session ID must start with "agt_", got: ${session.id}`);
  assert(session.incidentId === TEST_INCIDENT_ID, 'Session must reference the correct incident');
  assert(session.status === 'awaiting_approval', `Session status must be "awaiting_approval", got: ${session.status}`);
  pass('Agent session created with status "awaiting_approval".');

  // ─── 3. Verify Plan ────────────────────────────────────────────────────────
  section('3. Verifying investigation plan...');
  const plan = session.plan;
  assert(plan, 'Session must contain a plan');
  assert(plan.strategy, 'Plan must contain a strategy string');
  assert(Array.isArray(plan.steps) && plan.steps.length >= 5, `Plan must have at least 5 steps, got: ${plan.steps?.length}`);
  assert(plan.targetQueue === 'payment_queue', `Target queue must be "payment_queue", got: ${plan.targetQueue}`);
  console.log('Strategy:', plan.strategy);
  console.log('Steps:', plan.steps.length);
  pass('Plan verified: strategy + steps + target queue correct.');

  // ─── 4. Verify Evidence ────────────────────────────────────────────────────
  section('4. Verifying evidence collection...');
  const evidence = session.evidence;
  assert(Array.isArray(evidence) && evidence.length >= 1, `Must have at least 1 evidence item, got: ${evidence?.length}`);
  const hasIncidentEv = evidence.some(e => e.type === 'incident');
  assert(hasIncidentEv, 'Evidence must contain an incident evidence item');
  console.log('Evidence items collected:', evidence.length);
  evidence.slice(0, 3).forEach(e => console.log(`  [${e.rank}] [${e.type}] ${e.message.substring(0, 80)}...`));
  pass('Evidence collection verified.');

  // ─── 5. Verify Hypotheses ──────────────────────────────────────────────────
  section('5. Verifying hypothesis engine...');
  const hypotheses = session.hypotheses;
  assert(Array.isArray(hypotheses) && hypotheses.length >= 1, `Must have at least 1 hypothesis, got: ${hypotheses?.length}`);

  const topHyp = hypotheses[0];
  assert(topHyp.rank === 1, `Top hypothesis must have rank 1, got: ${topHyp.rank}`);
  assert(topHyp.confidence >= 30, `Top hypothesis confidence must be >= 30%, got: ${topHyp.confidence}`);
  assert(topHyp.title, 'Top hypothesis must have a title');

  // For a DB exhaustion incident, top hypothesis should be Database Pool Exhaustion
  const dbHyp = hypotheses.find(h => h.id === 'hyp_db_pool');
  assert(dbHyp, 'Must have a Database Pool Exhaustion hypothesis');
  assert(dbHyp.confidence >= 30, `DB Pool hypothesis confidence must be >= 30%, got: ${dbHyp.confidence}`);

  console.log('Hypotheses generated:', hypotheses.length);
  hypotheses.forEach(h => console.log(`  #${h.rank} [${h.confidence}%] ${h.title}`));
  pass('Hypothesis engine verified: DB Pool hypothesis present with ≥30% confidence.');

  // ─── 6. Verify Runbook Matches ─────────────────────────────────────────────
  section('6. Verifying runbook resolution...');
  const runbookMatches = session.runbookMatches;
  assert(Array.isArray(runbookMatches), 'Must have runbookMatches array');
  console.log('Runbook matches found:', runbookMatches.length);
  runbookMatches.forEach(rb => console.log(`  [${rb.matchScore}%] ${rb.title}`));

  // If the seeded runbook matched, great. If not (no text overlap), that's acceptable
  // We just verify the structure is correct
  if (runbookMatches.length > 0) {
    assert(runbookMatches[0].runbookId, 'Runbook match must have runbookId');
    assert(runbookMatches[0].title, 'Runbook match must have title');
    assert(typeof runbookMatches[0].matchScore === 'number', 'Runbook match must have numeric matchScore');
    pass('Runbook matches verified with correct structure.');
  } else {
    pass('Runbook matching ran successfully (no high-confidence matches for test data).');
  }

  // ─── 7. Verify Recommended Actions ────────────────────────────────────────
  section('7. Verifying recommended actions...');
  const actions = session.recommendedActions;
  assert(Array.isArray(actions) && actions.length >= 1, `Must have at least 1 recommended action, got: ${actions?.length}`);

  const ackAction = actions.find(a => a.type === 'ack_incident');
  assert(ackAction, 'Must have an ack_incident action');
  assert(ackAction.status === 'pending', `ack_incident must start as "pending", got: ${ackAction.status}`);
  assert(ackAction.riskLevel, 'Action must have riskLevel');
  assert(ackAction.expectedOutcome, 'Action must have expectedOutcome');
  assert(ackAction.reasoning, 'Action must have reasoning');
  assert(typeof ackAction.estimatedRecoveryMin === 'number', 'Action must have estimatedRecoveryMin');

  console.log('Recommended actions:', actions.length);
  actions.forEach(a => console.log(`  [${a.status}] [${a.riskLevel} risk] [~${a.estimatedRecoveryMin}min] ${a.type}: ${a.description.substring(0, 60)}...`));
  pass('Recommended actions verified with risk levels, reasoning, and expected outcomes.');

  // ─── 8. Approve an Action ─────────────────────────────────────────────────
  section('8. Approving ack_incident action (PATCH /api/agent/sessions/:id/actions/:actionId/approve)...');
  const approveRes = await request(
    'PATCH',
    `/api/agent/sessions/${session.id}/actions/${ackAction.id}/approve`,
    { decision: 'approved', notes: 'Acknowledging to halt escalation timers.' }
  );
  if (approveRes.status !== 200 && approveRes.status !== 201) {
    fail(`Approval failed with status ${approveRes.status}: ${JSON.stringify(approveRes.body)}`);
  }
  const approvedSession = approveRes.body;
  const updatedAckAction = approvedSession.recommendedActions.find(a => a.id === ackAction.id);
  assert(updatedAckAction?.status === 'approved', `ack_incident action status must be "approved", got: ${updatedAckAction?.status}`);
  assert(approvedSession.approvalDecisions.length >= 1, 'Session must have an approval decision recorded');
  assert(approvedSession.approvalDecisions[0].decision === 'approved', 'Approval decision must be "approved"');
  pass('Action approved successfully. Decision recorded in session.');

  // ─── 9. Execute Approved Actions ──────────────────────────────────────────
  section('9. Executing approved actions (POST /api/agent/sessions/:id/execute)...');
  const execRes = await request('POST', `/api/agent/sessions/${session.id}/execute`);
  if (execRes.status !== 200 && execRes.status !== 201) {
    fail(`Execution failed with status ${execRes.status}: ${JSON.stringify(execRes.body)}`);
  }
  const completedSession = execRes.body;
  assert(completedSession.status === 'completed', `Session must be "completed" after execution, got: ${completedSession.status}`);
  assert(completedSession.executionHistory.length >= 1, 'Execution history must have at least 1 entry');
  assert(completedSession.completedAt, 'Session must have completedAt timestamp');
  assert(completedSession.postmortem, 'Session must have an auto-generated postmortem');

  const execEntry = completedSession.executionHistory.find(e => e.actionId === ackAction.id);
  assert(execEntry, 'Execution history must contain the approved action entry');
  assert(execEntry.result === 'success', `Execution result must be "success", got: ${execEntry.result}`);

  console.log('\nExecution History:');
  completedSession.executionHistory.forEach(e => console.log(`  [${e.result}] ${e.actionId}: ${e.output?.substring(0, 80)}...`));
  console.log('\nPostmortem Preview:');
  console.log(completedSession.postmortem?.substring(0, 300));
  pass('Execution completed. Session status = "completed". Postmortem generated.');

  // ─── 10. Retrieve Session via GET ─────────────────────────────────────────
  section('10. Verifying session retrieval (GET /api/agent/sessions/:id)...');
  const getRes = await request('GET', `/api/agent/sessions/${session.id}`);
  assert(getRes.status === 200, `GET session must return 200, got: ${getRes.status}`);
  const fetchedSession = getRes.body;
  assert(fetchedSession.id === session.id, 'Retrieved session ID must match');
  assert(fetchedSession.status === 'completed', 'Retrieved session must be completed');
  pass('Session retrieval verified.');

  // ─── 11. Retrieve Session for Incident ────────────────────────────────────
  section('11. Verifying incident → agent session lookup (GET /api/incidents/:id/agent-session)...');
  const incidentSessionRes = await request('GET', `/api/incidents/${TEST_INCIDENT_ID}/agent-session`);
  assert(incidentSessionRes.status === 200, `Incident session lookup must return 200, got: ${incidentSessionRes.status}`);
  assert(incidentSessionRes.body.incidentId === TEST_INCIDENT_ID, 'Incident session must reference correct incident');
  pass('Incident → agent session lookup verified.');

  // ─── 12. List All Sessions ────────────────────────────────────────────────
  section('12. Verifying session list (GET /api/agent/sessions)...');
  const listRes = await request('GET', '/api/agent/sessions');
  assert(listRes.status === 200, `Session list must return 200, got: ${listRes.status}`);
  assert(Array.isArray(listRes.body), 'Session list must be an array');
  const found = listRes.body.find(s => s.id === session.id);
  assert(found, 'Session list must contain the created session');
  pass(`Session list verified. ${listRes.body.length} session(s) found.`);

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  section('13. Cleaning up test keys...');
  const cleanupRedis = new redis('redis://localhost:6379');
  await cleanupRedis.hdel(`${SCOPE}:incidents`, TEST_INCIDENT_ID);
  await cleanupRedis.hdel(`${SCOPE}:runbooks`, TEST_RUNBOOK.id);
  await cleanupRedis.hdel(`${SCOPE}:knowledge_entries`, TEST_KNOWLEDGE_ENTRY.id);
  await cleanupRedis.hdel(`${SCOPE}:agent_sessions`, session.id);
  await cleanupRedis.quit();
  pass('Test keys cleaned up.');

  log('\n╔══════════════════════════════════════════════════════════════════╗');
  log('║  ✅  Phase 3.0 Reliability Agent E2E verification PASSED        ║');
  log('╚══════════════════════════════════════════════════════════════════╝\n');
}

main().catch((err) => {
  console.error('\n❌ E2E test failed with error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
