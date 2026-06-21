/**
 * Phase 3.2 — Multi-Agent Reliability Team E2E Test
 *
 * Verifies that:
 *   1. Agents investigate independently and submit role findings.
 *   2. Findings are merged dynamically.
 *   3. Consensus report is generated based on combined evidence.
 */

const http = require('http');
const assert = require('assert');
const Redis = require('ioredis');

const API = 'http://localhost:3001';
const PROJECT_ID = 'proj_multi_agent_test';
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

function log(msg) { process.stdout.write(`${msg}\n`); }
function pass(msg) { log(`✓ ${msg}`); }
function fail(msg) { log(`✗ ${msg}`); process.exit(1); }
function section(msg) { log(`\n${msg}`); }

// ─── Seed Data ────────────────────────────────────────────────────────────────

const TEST_INCIDENT_ID = `inc_multi_agent_test_${Date.now()}`;
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
  id: `rb_multi_agent_test_db`,
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
  id: `know_multi_agent_db_001`,
  title: 'Resolution: Database Connection Pool Exhaustion',
  incidentId: 'inc_old_db_multi_agent_test',
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
  log('║     Phase 3.2 — Multi-Agent Reliability Team E2E Test            ║');
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
  section('1. Seeding project metadata, incident, runbooks, and logs...');
  const redisClient = new Redis('redis://localhost:6379');

  await redisClient.set(
    `queuewatch:project_metadata:${PROJECT_ID}`,
    JSON.stringify({ id: PROJECT_ID, name: 'Multi-Agent E2E Project', apiKey: 'qw_multi_agent_test', createdAt: Date.now(), hasReceivedTelemetry: true })
  );
  
  const meRes = await request('GET', '/api/auth/me');
  const userId = meRes.body?.username || meRes.body?.id || meRes.body?.sub || 'demo_user_sre_910';
  await redisClient.sadd(`queuewatch:user_projects:${userId}`, PROJECT_ID);
  
  await redisClient.sadd(`${SCOPE}:queues`, 'payment_queue');
  await redisClient.hset(`${SCOPE}:incidents`, TEST_INCIDENT_ID, JSON.stringify(TEST_INCIDENT));
  await redisClient.hset(`${SCOPE}:runbooks`, TEST_RUNBOOK.id, JSON.stringify(TEST_RUNBOOK));
  await redisClient.hset(`${SCOPE}:knowledge_entries`, TEST_KNOWLEDGE_ENTRY.id, JSON.stringify(TEST_KNOWLEDGE_ENTRY));

  // Seed metrics & logs for Telemetry Agent
  const mockMetrics = [
    { queueName: 'payment_queue', waitingCount: 15, activeCount: 5, completedCount: 100, failedCount: 22, delayedCount: 0, paused: false, throughput: 12.5, averageLatency: 4500, timestamp: Date.now() }
  ];
  await redisClient.set(`${SCOPE}:queues:metrics`, JSON.stringify(mockMetrics));

  const mockLogs = [
    { id: 'log_1', queueName: 'payment_queue', level: 'error', message: 'Postgres query connection pool timeout after 10000ms exception', timestamp: Date.now() - 60000 }
  ];
  await redisClient.lpush(`${SCOPE}:logs`, JSON.stringify(mockLogs[0]));

  // Seed deployment (correlated regression - deployed 5 mins before incident)
  const depTime = Date.now() - 10 * 60 * 1000;
  const depEvent = {
    id: 'dep_multi_agent_123',
    service: 'payment_queue',
    version: 'v2.1.4',
    commitSha: 'commit214214214',
    branch: 'release/v2.1.4',
    environment: 'production',
    deployedBy: 'SRE Coordinator',
    deployedAt: depTime,
  };
  await redisClient.lpush(`${SCOPE}:deployments`, JSON.stringify(depEvent));

  // Seed reliability score in Redis
  const reliabilityScore = {
    id: `score_payment_queue_${Date.now()}`,
    targetId: 'payment_queue',
    targetType: 'queue',
    score: 40,
    failureRate: 35,
    retryRate: 0,
    backlogGrowth: 0,
    workerHealthScore: 100,
    incidentFrequency: 1,
    timestamp: Date.now(),
    contributors: {
      failureRate: -15,
      latency: -15,
      workerHealth: 0,
      incidents: -25,
      blastRadius: -5,
      deployments: 0
    }
  };
  await redisClient.hset(`${SCOPE}:reliability_scores`, `queue:payment_queue`, JSON.stringify(reliabilityScore));

  // Seed service registry mapping
  const paymentServiceObj = {
    id: 'svc_payment',
    name: 'payment-service',
    description: 'Handles Stripe card charges',
    environment: 'production',
    owner: 'Billing SRE',
    status: 'critical',
    createdAt: Date.now(),
    queues: ['payment_queue'],
    workers: ['worker_pay_1'],
    deployments: ['dep_multi_agent_123'],
    incidents: [TEST_INCIDENT_ID]
  };
  await redisClient.hset(`${SCOPE}:services`, 'svc_payment', JSON.stringify(paymentServiceObj));

  // Seed dependency graph showing downstream affected nodes
  const dependencyGraph = {
    nodes: [
      { id: 'svc_payment', label: 'payment-service', type: 'service' },
      { id: 'payment_queue', label: 'payment_queue', type: 'queue' },
      { id: 'email_notifications', label: 'email_notifications', type: 'queue' },
      { id: 'svc_notifications', label: 'notification-service', type: 'service' }
    ],
    edges: [
      { from: 'svc_payment', to: 'payment_queue' },
      { from: 'payment_queue', to: 'email_notifications' },
      { from: 'email_notifications', to: 'svc_notifications' }
    ],
    serviceImpacts: {
      'svc_payment': ['svc_notifications']
    }
  };
  await redisClient.set(`${SCOPE}:dependency_graph`, JSON.stringify(dependencyGraph));

  await redisClient.quit();
  pass('Seeded test environment keys.');

  // ─── 2. Run Diagnostics ────────────────────────────────────────────────────
  section('2. Dispatching SRE Agent Team (POST /api/agent/run)...');
  const runRes = await request('POST', '/api/agent/run', { incidentId: TEST_INCIDENT_ID });
  if (runRes.status !== 200 && runRes.status !== 201) {
    fail(`Agent run failed with status ${runRes.status}: ${JSON.stringify(runRes.body)}`);
  }

  const session = runRes.body;
  log(`  Session ID: ${session.id}`);
  log(`  Session Status: ${session.status}`);

  assert(session.id, 'Session must have an ID');
  assert(session.status === 'awaiting_approval', `Expected status "awaiting_approval", got: ${session.status}`);
  pass('Multi-agent session finished and reached "awaiting_approval" status.');

  // ─── 3. Verify Team Findings ────────────────────────────────────────────────
  section('3. Verifying individual agent findings...');
  const findings = session.teamFindings;
  assert(Array.isArray(findings), 'teamFindings must be an array');
  assert(findings.length === 6, `Expected findings from 6 SRE agents, got: ${findings.length}`);

  const roles = findings.map(f => f.agentRole);
  assert(roles.includes('incident_commander'), 'Missing Incident Commander agent');
  assert(roles.includes('telemetry'), 'Missing Telemetry agent');
  assert(roles.includes('deployment'), 'Missing Deployment agent');
  assert(roles.includes('dependency'), 'Missing Dependency agent');
  assert(roles.includes('knowledge'), 'Missing Knowledge agent');
  assert(roles.includes('recovery'), 'Missing Recovery agent');

  findings.forEach(agent => {
    log(`  [${agent.status.toUpperCase()}] [Conf: ${agent.confidenceScore}%] ${agent.agentRole}`);
    assert(agent.status === 'completed', `Expected completed status for ${agent.agentRole}, got: ${agent.status}`);
    assert(Array.isArray(agent.findings) && agent.findings.length > 0, `Expected non-empty findings logs for ${agent.agentRole}`);
    assert(agent.analysis, `Expected text analysis summary for ${agent.agentRole}`);
  });
  
  pass('All 6 specialized agents successfully investigated and submitted reports.');

  // ─── 4. Verify Telemetry Agent Anomalies ────────────────────────────────────
  section('4. Verifying Telemetry Agent anomaly collection...');
  const telemetry = findings.find(f => f.agentRole === 'telemetry');
  const hasErrorAlert = telemetry.findings.some(f => f.toLowerCase().includes('pool timeout') || f.toLowerCase().includes('postgres'));
  assert(hasErrorAlert, 'Telemetry agent failed to capture Postgres timeout log error');
  pass('Telemetry Agent successfully identified metric anomalies and error logs.');

  // ─── 5. Verify Consensus Engine Report ─────────────────────────────────────
  section('5. Verifying SRE Consensus report merging...');
  const report = session.consensusReport;
  assert(report, 'Consensus report is missing');
  assert(report.summary, 'Consensus summary text is missing');
  assert(report.agreedRootCause === 'Database Connection Pool Exhaustion', `Expected agreed root cause "Database Connection Pool Exhaustion", got: ${report.agreedRootCause}`);
  assert(typeof report.overallConfidenceScore === 'number' && report.overallConfidenceScore > 50, `Expected high overall confidence score, got: ${report.overallConfidenceScore}`);
  assert(report.consensusStrength === 'high' || report.consensusStrength === 'medium', `Expected strong consensus strength, got: ${report.consensusStrength}`);
  assert(Array.isArray(report.combinedEvidenceIds) && report.combinedEvidenceIds.length > 0, 'Consensus combinedEvidenceIds should be a non-empty array');
  assert(Array.isArray(report.recommendedActions) && report.recommendedActions.length > 0, 'Consensus recommendedActions should be a non-empty array');

  log(`  Overall Confidence: ${report.overallConfidenceScore}% (${report.consensusStrength})`);
  log(`  Agreed Root Cause: ${report.agreedRootCause}`);
  log(`  Summary: ${report.summary}`);
  pass('Consensus Engine successfully merged findings into Final SRE Investigation Report.');

  // ─── Cleanup ──────────────────────────────────────────────────────────────
  section('6. Cleaning up test keys...');
  const cleanupRedis = new Redis('redis://localhost:6379');
  await cleanupRedis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await cleanupRedis.srem(`queuewatch:user_projects:${userId}`, PROJECT_ID);
  await cleanupRedis.del(`${SCOPE}:incidents`);
  await cleanupRedis.del(`${SCOPE}:runbooks`);
  await cleanupRedis.del(`${SCOPE}:knowledge_entries`);
  await cleanupRedis.del(`${SCOPE}:agent_sessions`);
  await cleanupRedis.del(`${SCOPE}:queues:metrics`);
  await cleanupRedis.del(`${SCOPE}:logs:payment_queue`);
  await cleanupRedis.quit();
  pass('Cleanup complete.');

  log('\n╔══════════════════════════════════════════════════════════════════╗');
  log('║  ✅  Phase 3.2 Multi-Agent Reliability Team E2E passed          ║');
  log('╚══════════════════════════════════════════════════════════════════╝\n');
}

main().catch((err) => {
  console.error('\n❌ E2E test failed with error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
