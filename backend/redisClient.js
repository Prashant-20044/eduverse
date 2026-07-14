const { createClient } = require('redis');

let redisClient = null;

const initRedis = async () => {
  if (!process.env.REDIS_URL) {
    console.warn('REDIS_URL is not defined in .env. Redis caching and pub/sub will be disabled.');
    return null;
  }

  try {
    redisClient = createClient({
      url: process.env.REDIS_URL,
    });

    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    redisClient.on('connect', () => console.log('Connected to Redis'));

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    return null;
  }
};

const getRedisClient = () => redisClient;

module.exports = { initRedis, getRedisClient };
