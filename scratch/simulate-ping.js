const PROJECT_ID = 'proj_1781298733903_94v8n1';
const API_KEY = 'qw_pk_7h592nvn75oapfi1';
const ENDPOINT = 'http://localhost:3001';

console.log(`Starting telemetry simulation for project: ${PROJECT_ID}`);
console.log(`Sending data to: ${ENDPOINT}`);

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
  try {
    const res = await fetch(`${ENDPOINT}/api/ingest/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        projectId: PROJECT_ID,
        workerId: 'worker_email_notifications_1',
        queueName: 'email_notifications',
        status: 'healthy',
        concurrency: 2,
        cpuUsage: Math.floor(Math.random() * 20) + 5,
        memoryUsage: Math.floor(Math.random() * 15) + 20,
      }),
    });
    console.log('Sent heartbeat:', res.status);
  } catch (err) {
    console.error('Heartbeat failed:', err.message);
  }
}

async function sendEvents() {
  try {
    const jobId = `job_${Math.random().toString(36).substr(2, 9)}`;
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
            queueName: 'email_notifications',
            jobId: jobId,
            jobName: 'send_welcome_email',
            status: 'waiting',
            payload: { email: 'user@example.com' },
          },
        ],
      }),
    });
    console.log('Sent event (created):', res.status);

    // Simulate completion 1 second later
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
                type: 'job.completed',
                queueName: 'email_notifications',
                jobId: jobId,
                jobName: 'send_welcome_email',
                status: 'completed',
                duration: Math.floor(Math.random() * 800) + 100,
              },
            ],
          }),
        });
        console.log('Sent event (completed):', jobId);
      } catch (err) {
        console.error('Completion event failed:', err.message);
      }
    }, 1000);
  } catch (err) {
    console.error('Event submission failed:', err.message);
  }
}

async function run() {
  await sendVerify();
  
  // Send initial data
  await sendHeartbeat();
  await sendEvents();

  // Keep sending periodic ticks
  setInterval(sendHeartbeat, 5000);
  setInterval(sendEvents, 8000);
}

run();
