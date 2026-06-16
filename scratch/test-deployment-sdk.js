const { QueueWatch } = require('../packages/node-sdk/dist/index.js');

const PROJECT_ID = 'proj_1781301728667_k5undm';
const API_KEY = 'qw_pk_u25by1t7na1ne7ks';
const ENDPOINT = 'http://localhost:3001';

console.log('Initializing QueueWatch SDK...');
const qw = new QueueWatch({
  projectId: PROJECT_ID,
  apiKey: API_KEY,
  endpoint: ENDPOINT,
  service: 'payment-service'
});

async function main() {
  console.log('Tracking deployment...');
  await qw.trackDeployment({
    service: 'payment-service',
    version: 'v2.1.0',
    commit: 'abc123de',
    branch: 'release/v2.1',
    environment: 'production',
    metadata: {
      deployed_by: 'SRE Automation Client',
      reason: 'Scaling payment gateway connection pool size'
    }
  });

  console.log('Deployment tracking payload sent.');
  // Wait to let it flush
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('Done.');
}

main().catch(err => {
  console.error('Error in test script:', err);
});
