require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { initRedis, getRedisClient } = require('./redisClient');

(async () => {
  console.log('Testing Redis connection...');
  const client = await initRedis();

  if (!client) {
    console.log('Redis client could not be initialized. Check your REDIS_URL in .env.');
    process.exit(1);
  }

  try {
    await client.set('coaching:test', 'redis-ok');
    const value = await client.get('coaching:test');
    console.log('Redis SET/GET OK:', value);
    await client.del('coaching:test');
    console.log('Redis test completed successfully.');
  } catch (err) {
    console.error('Redis test failed:', err);
    process.exit(1);
  }
})();
