/**
 * Phase 3.1 — Assisted Remediation Engine E2E Test
 * 
 * Tests the full lifecycle:
 *   Create → Approve → Execute → Verify → Rollback → Reject
 */

const Redis = require('ioredis');

const ENDPOINT = 'http://localhost:3001';
const PROJECT_ID = 'proj_rem_test_3_1';
const TEST_INCIDENT_ID = `inc_rem_test_${Date.now()}`;
const SCOPE = `queuewatch:project:${PROJECT_ID}`;

const TEST_INCIDENT = {
  id: TEST_INCIDENT_ID,
  title: 'Postgres database connection pool timeout spike',
  severity: 'critical',
  affectedQueue: 'payment_queue',
  fingerprint: `${PROJECT_ID}:rem_test:payment_queue`,
  status: 'open',
  firstDetectedAt: Date.now(),
  lastUpdatedAt: Date.now(),
  summary: 'Database connection pool timed out.',
  evidence: 'Postgres connection pool timeout after 10000ms.',
  suspectedRootCause: 'Database connection limits saturation.',
  recommendation: 'Scale workers and reduce concurrency.',
  impact: 'Checkout queue blocked.',
  relatedErrors: ['Postgres pool timeout'],
};

const TEST_ACTION = {
  id: `act_rem_test_${Date.now()}`,
  type: 'pause_queue',
  description: 'Pause payment_queue to halt new job ingestion while investigating DB pool saturation.',
  reasoning: 'Pausing the queue will stop new jobs from being ingested, reducing pressure on the connection pool.',
  riskLevel: 'medium',
  expectedOutcome: 'Queue ingestion halts. Existing active jobs complete. DB pool pressure reduces.',
  estimatedRecoveryMin: 5,
  command: 'queue.pause("payment_queue")',
  status: 'pending',
  payload: { queueName: 'payment_queue' },
};

// ─── Utilities ─────────────────────────────────────────────────────────────────

let authToken = null;
let authHeaders = {};
let errors = 0;
let passed = 0;

function section(title) {
  console.log(`\n${title}`);
}

function pass(msg) {
  console.log(`✓ ${msg}`);
  passed++;
}

function fail(msg) {
  console.error(`✗ FAIL: ${msg}`);
  errors++;
}

function log(msg) {
  console.log(`  ${msg}`);
}

async function request(method, path, body, headers) {
  const opts = {
    method,
    headers: { 
      'Content-Type': 'application/json',
      ...authHeaders, 
      ...(headers || {}) 
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${ENDPOINT}${path}`, opts);
  let resBody;
  try {
    resBody = await res.json();
  } catch (_) {
    resBody = {};
  }
  return { status: res.status, body: resBody };
}

// ─── Main Test ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   Phase 3.1 — Assisted Remediation Engine E2E Verification      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // ─── Auth ──────────────────────────────────────────────────────────────────
  section('0. Authenticating as demo user...');
  const loginRes = await request('POST', '/api/auth/login', {
    email: 'demo@queuewatch.dev',
    password: 'password123',
  }, {});
  if (loginRes.status !== 200 && loginRes.status !== 201) {
    fail(`Auth failed: ${JSON.stringify(loginRes.body)}`);
    process.exit(1);
  }
  authToken = loginRes.body.token;
  authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
    'x-project-id': PROJECT_ID,
  };
  pass('Authenticated successfully.');

  // ─── Seed ──────────────────────────────────────────────────────────────────
  section('1. Seeding test project and incident into Redis...');
  const redis = new Redis('redis://localhost:6379');
  await redis.set(
    `queuewatch:project_metadata:${PROJECT_ID}`,
    JSON.stringify({ id: PROJECT_ID, name: 'Remediation E2E Test Project', apiKey: 'qw_rem_test_key', createdAt: Date.now(), hasReceivedTelemetry: true })
  );
  const meRes = await request('GET', '/api/auth/me');
  const userId = meRes.body?.username || meRes.body?.id || meRes.body?.sub || 'demo_user_sre_910';
  await redis.sadd(`queuewatch:user_projects:${userId}`, PROJECT_ID);
  await redis.hset(`${SCOPE}:incidents`, TEST_INCIDENT_ID, JSON.stringify(TEST_INCIDENT));
  log(`Linked project to user: ${userId}`);
  pass('Seeded project and incident.');

  // ─── 2. Create Remediation Record ──────────────────────────────────────────
  section('2. Creating remediation record (POST /api/remediation)...');
  const createRes = await request('POST', '/api/remediation', {
    action: TEST_ACTION,
    incidentId: TEST_INCIDENT_ID,
  });
  if (createRes.status !== 200 && createRes.status !== 201) {
    fail(`Create failed: ${JSON.stringify(createRes.body)}`);
  } else {
    const record = createRes.body;
    log(`Record ID: ${record.id}`);
    log(`Status: ${record.status}`);
    log(`Rollback plan: ${record.rollbackPlan?.description}`);
    if (record.status !== 'pending_approval') {
      fail(`Expected status "pending_approval", got "${record.status}"`);
    } else if (!record.rollbackPlan || !record.rollbackPlan.rollbackActionType) {
      fail('Rollback plan missing or incomplete');
    } else {
      pass('Remediation record created with status "pending_approval" and rollback plan.');
    }
    global.testRecordId = record.id;
  }

  // ─── 3. Verify record is listed ────────────────────────────────────────────
  section('3. Verifying record is listed (GET /api/remediation)...');
  const listRes = await request('GET', '/api/remediation');
  if (listRes.status !== 200) {
    fail(`List failed: ${listRes.status}`);
  } else {
    const found = listRes.body.find(r => r.id === global.testRecordId);
    if (!found) {
      fail('Created record not found in list.');
    } else {
      pass(`Record found in list. Total records: ${listRes.body.length}.`);
    }
  }

  // ─── 4. Verify incident lookup ─────────────────────────────────────────────
  section('4. Verifying incident → records lookup (GET /api/remediation/incident/:id)...');
  const incLookupRes = await request('GET', `/api/remediation/incident/${TEST_INCIDENT_ID}`);
  if (incLookupRes.status !== 200) {
    fail(`Incident lookup failed: ${incLookupRes.status}`);
  } else {
    const found = incLookupRes.body.find(r => r.id === global.testRecordId);
    if (!found) {
      fail('Record not found via incident lookup.');
    } else {
      pass('Incident → records lookup verified.');
    }
  }

  // ─── 5. Approve ────────────────────────────────────────────────────────────
  section('5. Approving the record (PATCH /api/remediation/:id/approve)...');
  const approveRes = await request('PATCH', `/api/remediation/${global.testRecordId}/approve`, {});
  if (approveRes.status !== 200) {
    fail(`Approve failed: ${JSON.stringify(approveRes.body)}`);
  } else {
    log(`Status after approval: ${approveRes.body.status}`);
    log(`Approved by: ${approveRes.body.approvedBy}`);
    if (approveRes.body.status !== 'approved') {
      fail(`Expected "approved", got "${approveRes.body.status}"`);
    } else if (!approveRes.body.approvedBy) {
      fail('approvedBy not recorded');
    } else {
      pass('Record approved. approvedBy captured.');
    }
  }

  // ─── 6. Execute ────────────────────────────────────────────────────────────
  section('6. Executing the approved record (POST /api/remediation/:id/execute)...');
  const execRes = await request('POST', `/api/remediation/${global.testRecordId}/execute`);
  if (execRes.status !== 200 && execRes.status !== 201) {
    fail(`Execute failed: ${JSON.stringify(execRes.body)}`);
  } else {
    log(`Status after execution: ${execRes.body.status}`);
    log(`Execution log entries: ${execRes.body.executionLog?.length}`);
    if (execRes.body.status !== 'succeeded' && execRes.body.status !== 'failed') {
      fail(`Expected "succeeded" or "failed", got "${execRes.body.status}"`);
    } else {
      pass(`Execution completed with status "${execRes.body.status}". Execution log has ${execRes.body.executionLog?.length} entries.`);
    }
  }

  // ─── 7. Verify timeline events appended ────────────────────────────────────
  section('7. Verifying timeline events appended to incident...');
  // Wait briefly for timeline to be written
  await new Promise(r => setTimeout(r, 500));
  const timelineRes = await request('GET', `/api/incidents/${TEST_INCIDENT_ID}/timeline`);
  if (timelineRes.status !== 200) {
    fail(`Timeline fetch failed: ${timelineRes.status}`);
  } else {
    const events = timelineRes.body;
    const remedEvents = events.filter(e =>
      e.event && e.event.startsWith('remediation.')
    );
    log(`Timeline events total: ${events.length}, remediation events: ${remedEvents.length}`);
    log(`Event types: ${remedEvents.map(e => e.event).join(', ')}`);
    if (remedEvents.length < 2) {
      fail(`Expected ≥2 remediation timeline events, found ${remedEvents.length}`);
    } else {
      pass(`Timeline has ${remedEvents.length} remediation events: ${remedEvents.map(e => e.event).join(', ')}`);
    }
  }

  // ─── 8. Rollback ───────────────────────────────────────────────────────────
  section('8. Executing rollback (POST /api/remediation/:id/rollback)...');
  const rollbackRes = await request('POST', `/api/remediation/${global.testRecordId}/rollback`);
  if (rollbackRes.status !== 200 && rollbackRes.status !== 201) {
    fail(`Rollback failed: ${JSON.stringify(rollbackRes.body)}`);
  } else {
    log(`Status after rollback: ${rollbackRes.body.status}`);
    log(`Execution log entries: ${rollbackRes.body.executionLog?.length}`);
    if (rollbackRes.body.status !== 'rolled_back') {
      fail(`Expected "rolled_back", got "${rollbackRes.body.status}"`);
    } else {
      pass(`Rollback succeeded. Status = "rolled_back". Log has ${rollbackRes.body.executionLog?.length} entries.`);
    }
  }

  // ─── 9. Reject test (separate record) ─────────────────────────────────────
  section('9. Testing rejection flow (create + reject)...');
  const createRes2 = await request('POST', '/api/remediation', {
    action: { ...TEST_ACTION, id: `act_reject_test_${Date.now()}`, type: 'scale_workers' },
    incidentId: TEST_INCIDENT_ID,
  });
  if (createRes2.status !== 200 && createRes2.status !== 201) {
    fail(`Create (for rejection test) failed: ${createRes2.status}`);
  } else {
    const rejectId = createRes2.body.id;
    const rejectRes = await request('PATCH', `/api/remediation/${rejectId}/reject`, { notes: 'Not safe to scale at this time.' });
    if (rejectRes.status !== 200) {
      fail(`Reject failed: ${JSON.stringify(rejectRes.body)}`);
    } else {
      log(`Status: ${rejectRes.body.status}, rejectedBy: ${rejectRes.body.rejectedBy}`);
      if (rejectRes.body.status !== 'rejected') {
        fail(`Expected "rejected", got "${rejectRes.body.status}"`);
      } else {
        pass(`Rejection flow verified. Status = "rejected", rejectedBy = "${rejectRes.body.rejectedBy}".`);
      }
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────
  section('10. Cleaning up test keys...');
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.srem(`queuewatch:user_projects:${userId}`, PROJECT_ID);
  await redis.del(`${SCOPE}:incidents`);
  await redis.del(`${SCOPE}:remediation_records`);
  await redis.del(`${SCOPE}:incident_timeline:${TEST_INCIDENT_ID}`);
  await redis.del(`${SCOPE}:incident_runbook_events:${TEST_INCIDENT_ID}`);
  await redis.quit();
  pass('Test keys cleaned up.');

  // ─── Summary ───────────────────────────────────────────────────────────────
  const total = passed + errors;
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  if (errors === 0) {
    console.log(`║  ✅  Phase 3.1 Remediation Engine E2E verification PASSED        ║`);
  } else {
    console.log(`║  ❌  Phase 3.1 E2E: ${errors}/${total} assertions FAILED                   ║`);
  }
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  if (errors > 0) process.exit(1);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
