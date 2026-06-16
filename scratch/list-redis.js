const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

async function main() {
  console.log('Scanning Redis keys...');
  const keys = await redis.keys('queuewatch:*');
  console.log('All QueueWatch keys:', keys);

  const apiKeys = await redis.keys('queuewatch:api_keys:*');
  console.log('\n--- API Key Mappings ---');
  for (const key of apiKeys) {
    const val = await redis.get(key);
    console.log(`${key} => ${val}`);
  }

  const projects = await redis.keys('queuewatch:projects:*');
  console.log('\n--- Projects ---');
  for (const key of projects) {
    const val = await redis.get(key);
    console.log(`${key} => ${val}`);
  }

  console.log('\nDone.');
  redis.disconnect();
}

main().catch(err => {
  console.error(err);
  redis.disconnect();
});
