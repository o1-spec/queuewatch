const Redis = require('ioredis');

const ENDPOINT = 'http://localhost:3001';
const PROJECT_ID = `proj_performance_${Date.now()}`;
const API_KEY = `qw_pk_perf_${Date.now()}`;
const redis = new Redis({ host: 'localhost', port: 6379 });

async function getRedisMemory() {
  const info = await redis.info('memory');
  const match = info.match(/used_memory:(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

async function runBenchmarkForCount(count, authHeaders, sdkHeaders) {
  console.log(`\n--- Running Benchmark for ${count} telemetry records ---`);

  const initialMemory = await getRedisMemory();
  console.log(`  Initial Redis Memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);

  // Direct seed to simulate Redis load
  console.log(`  Directly seeding ${count} telemetry records to Redis...`);
  const pipeline = redis.pipeline();
  const now = Date.now();
  const queueNames = ['payment_queue', 'email_queue', 'sms_queue'];

  for (let i = 0; i < count; i++) {
    const queue = queueNames[i % 3];
    const event = {
      id: `tel_perf_${i}`,
      type: i % 10 === 0 ? 'job.failed' : 'job.completed',
      queueName: queue,
      serviceName: 'payment-service',
      duration: Math.floor(Math.random() * 500),
      timestamp: now - (i * 1000) // spread out over time
    };
    pipeline.rpush(`queuewatch:project:${PROJECT_ID}:telemetry:${queue}`, JSON.stringify(event));
  }
  
  const startTime = Date.now();
  await pipeline.exec();
  const seedDuration = Date.now() - startTime;
  console.log(`  Direct seed completed in ${seedDuration}ms`);

  const finalMemory = await getRedisMemory();
  const memoryGrowth = finalMemory - initialMemory;
  console.log(`  Final Redis Memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Redis Memory Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);

  // Test REST API bulk ingestion throughput (Send 10 batches of 500 events = 5,000 events)
  console.log('  Testing API bulk ingestion endpoint throughput (10 x 500 events)...');
  const batchSize = 500;
  const numBatches = 10;
  const ingestStart = Date.now();
  
  const ingestPromises = [];
  for (let b = 0; b < numBatches; b++) {
    const events = [];
    for (let i = 0; i < batchSize; i++) {
      events.push({
        id: `tel_ingest_perf_${b}_${i}`,
        type: 'job.completed',
        queueName: 'payment_queue',
        serviceName: 'payment-service',
        duration: 150,
        timestamp: Date.now()
      });
    }

    ingestPromises.push(
      fetch(`${ENDPOINT}/api/ingest/events`, {
        method: 'POST',
        headers: sdkHeaders,
        body: JSON.stringify({ projectId: PROJECT_ID, events })
      })
    );
  }

  await Promise.all(ingestPromises);
  const ingestDuration = Date.now() - ingestStart;
  const throughput = (batchSize * numBatches) / (ingestDuration / 1000);
  console.log(`  API Bulk Ingest completed in ${ingestDuration}ms (${throughput.toFixed(0)} events/sec)`);

  // Measure Query Response times (SRE Dashboard loads)
  console.log('  Measuring SRE dashboard query response latencies...');
  const queryStart = Date.now();
  const q1 = fetch(`${ENDPOINT}/api/reliability`, { headers: authHeaders });
  const q2 = fetch(`${ENDPOINT}/api/health-center`, { headers: authHeaders });
  const q3 = fetch(`${ENDPOINT}/api/services`, { headers: authHeaders });
  
  const [res1, res2, res3] = await Promise.all([q1, q2, q3]);
  const queryDuration = Date.now() - queryStart;
  console.log(`  Dashboard query latency: ${queryDuration}ms`);

  if (!res1.ok || !res2.ok || !res3.ok) {
    throw new Error('FAIL: Dashboard queries failed during benchmark');
  }

  // Cleanup telemetry keys for next run
  for (const q of queueNames) {
    await redis.del(`queuewatch:project:${PROJECT_ID}:telemetry:${q}`);
  }
  await redis.del(`queuewatch:project:${PROJECT_ID}:queues`);

  return {
    count,
    memoryGrowthMb: parseFloat((memoryGrowth / 1024 / 1024).toFixed(2)),
    ingestLatencyMs: ingestDuration,
    throughputEventsSec: Math.round(throughput),
    queryLatencyMs: queryDuration
  };
}

async function main() {
  console.log('--- Benchmarking QueueWatch Telemetry Performance ---');

  // Seed project, key mapping, SRE user
  await redis.set(`queuewatch:project_metadata:${PROJECT_ID}`, JSON.stringify({
    id: PROJECT_ID,
    name: 'Performance Project',
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
  const sdkHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`
  };

  // Run benchmarks
  const b10k = await runBenchmarkForCount(10000, authHeaders, sdkHeaders);
  const b50k = await runBenchmarkForCount(50000, authHeaders, sdkHeaders);
  const b100k = await runBenchmarkForCount(100000, authHeaders, sdkHeaders);

  console.log('\n--- PERFORMANCE RESULTS SUMMARY ---');
  console.table([b10k, b50k, b100k]);

  // Clean up
  await redis.del(`queuewatch:project_metadata:${PROJECT_ID}`);
  await redis.del(`queuewatch:api_keys:${API_KEY}`);
  await redis.srem('queuewatch:user_projects:demo_user_sre_910', PROJECT_ID);
  await redis.del(`queuewatch:project:${PROJECT_ID}:reliability_scores`);
  await redis.del(`queuewatch:project:${PROJECT_ID}:services`);
  redis.disconnect();

  console.log('\n✓ SUCCESS: Performance Benchmarking Completed.');
  // Return result JSON string so it can be captured by the orchestrator
  console.log('__PERF_RESULTS_JSON__' + JSON.stringify({ b10k, b50k, b100k }) + '__PERF_RESULTS_JSON__');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Performance Benchmark Error:', err);
    process.exit(1);
  });
}
