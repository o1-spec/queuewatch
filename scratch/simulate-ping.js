const PROJECT_ID = 'proj_1781301728667_k5undm';
const API_KEY = 'qw_pk_u25by1t7na1ne7ks';
const ENDPOINT = 'http://localhost:3001';

console.log(`Starting SRE multi-service telemetry simulation for project: ${PROJECT_ID}`);
console.log(`Sending data to: ${ENDPOINT}`);

const servicesToSimulate = [
  {
    serviceName: 'payment-service',
    queues: [
      { name: 'payment_queue', worker: 'worker-1', status: 'healthy', concurrency: 5 },
      { name: 'email_queue', worker: 'worker-2', status: 'healthy', concurrency: 10 },
      { name: 'webhook_queue', worker: 'worker-1', status: 'healthy', concurrency: 5 }
    ]
  },
  {
    serviceName: 'email-service',
    queues: [
      { name: 'email_notifications', worker: 'worker_email_notifications_1', status: 'healthy', concurrency: 2 }
    ]
  }
];

async function sendVerify() {
  try {
    const res = await fetch(`${ENDPOINT}/api/ingest/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ projectId: PROJECT_ID }),
    });
    const data = await res.json();
    console.log('Verification response:', data);
  } catch (err) {
    console.error('Verification failed:', err.message);
  }
}

async function sendHeartbeat() {
  for (const svc of servicesToSimulate) {
    for (const q of svc.queues) {
      try {
        const res = await fetch(`${ENDPOINT}/api/ingest/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            projectId: PROJECT_ID,
            serviceName: svc.serviceName,
            workerId: q.worker,
            queueName: q.name,
            status: q.status,
            concurrency: q.concurrency,
            cpuUsage: Math.floor(Math.random() * 20) + 5,
            memoryUsage: Math.floor(Math.random() * 15) + 20,
          }),
        });
        console.log(`Sent heartbeat for ${svc.serviceName} (${q.name}): ${res.status}`);
      } catch (err) {
        console.error(`Heartbeat failed for ${q.name}:`, err.message);
      }
    }
  }
}

async function sendEvents() {
  // Choose a random service and queue
  const svc = servicesToSimulate[Math.floor(Math.random() * servicesToSimulate.length)];
  const q = svc.queues[Math.floor(Math.random() * svc.queues.length)];
  
  const jobId = `job_${Math.random().toString(36).substr(2, 9)}`;
  const traceId = `tr_${Math.floor(Math.random() * 90000 + 10000)}`;
  const jobNames = {
    payment_queue: 'process_invoice_payment',
    email_queue: 'send_payment_receipt_pdf',
    webhook_queue: 'dispatch_callback_webhook',
    email_notifications: 'send_welcome_onboarding_email'
  };
  const jobName = jobNames[q.name] || 'generic_task';

  try {
    // 1. Send job.created
    const res = await fetch(`${ENDPOINT}/api/ingest/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        events: [
          {
            type: 'job.created',
            serviceName: svc.serviceName,
            queueName: q.name,
            jobId: jobId,
            jobName: jobName,
            status: 'waiting',
            traceId: traceId,
            payload: { amount: Math.floor(Math.random() * 250) + 10, currency: 'USD', userId: 'usr_9123', traceId: traceId },
          },
        ],
      }),
    });
    console.log(`Sent job.created for ${svc.serviceName} (${q.name}): ${res.status}`);

    // 2. Simulate active state after 800ms
    setTimeout(async () => {
      try {
        await fetch(`${ENDPOINT}/api/ingest/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
          },
          body: JSON.stringify({
            projectId: PROJECT_ID,
            events: [
              {
                type: 'job.active',
                serviceName: svc.serviceName,
                queueName: q.name,
                jobId: jobId,
                jobName: jobName,
                status: 'active',
                traceId: traceId,
              },
            ],
          }),
        });

        // 3. Simulate completion or failure after 1200ms
        setTimeout(async () => {
          // Stripe/payment queue has a higher failure rate (20%) to show active incidents / errors
          const isFailed = q.name === 'payment_queue' ? Math.random() < 0.25 : Math.random() < 0.05;
          const eventType = isFailed ? 'job.failed' : 'job.completed';
          const eventStatus = isFailed ? 'failed' : 'completed';
          const errorMessage = isFailed 
            ? 'Stripe API connection timeout: HTTP 504 Gateway Timeout at payment-gateway-us-east.stripe.com' 
            : undefined;

          // Latency spike simulator (occasionally > 5s latency on payment_queue completed jobs)
          const latencyVal = (q.name === 'payment_queue' && !isFailed && Math.random() < 0.3)
            ? Math.floor(Math.random() * 2000) + 5200
            : Math.floor(Math.random() * 800) + 120;

          try {
            await fetch(`${ENDPOINT}/api/ingest/events`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
              },
              body: JSON.stringify({
                projectId: PROJECT_ID,
                events: [
                  {
                    type: eventType,
                    serviceName: svc.serviceName,
                    queueName: q.name,
                    jobId: jobId,
                    jobName: jobName,
                    status: eventStatus,
                    duration: latencyVal,
                    errorMessage: errorMessage,
                    attemptsMade: isFailed ? 1 : 0,
                    maxAttempts: 3,
                    traceId: traceId,
                  },
                ],
              }),
            });
            console.log(`Sent job status update (${eventType}) for ${q.name}: ${jobId} (Trace: ${traceId}, Latency: ${latencyVal}ms)`);
          } catch (err) {
            console.error(`Status change update failed:`, err.message);
          }
        }, 1200);

      } catch (err) {
        console.error(`Active state change failed:`, err.message);
      }
    }, 800);

  } catch (err) {
    console.error(`Event submission failed:`, err.message);
  }
}

async function run() {
  await sendVerify();
  
  // Send initial data
  await sendHeartbeat();
  await sendEvents();

  // Keep sending periodic SRE telemetry metrics
  setInterval(sendHeartbeat, 15000);
  setInterval(sendEvents, 5000);
}

run();
