const { createClient } = require('redis');

let redisClient = null;
let redisConnectPromise = null;

const initRedis = async () => {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URL_DISABLED;

  if (!redisUrl) {
    console.warn('No Redis URL is defined in .env. Redis caching and pub/sub will be disabled.');
    return null;
  }

  if (!redisClient) {
    redisClient = createClient({
      url: redisUrl,
      socket: {
        family: 4,
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            return false;
          }

          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on('error', (err) => console.error('Redis Client Error:', err));
    redisClient.on('connect', () => console.log('Connected to Redis'));
    redisClient.on('ready', () => console.log('Redis is ready'));
  }

  if (redisClient.isReady) {
    return redisClient;
  }

  if (!redisConnectPromise) {
    redisConnectPromise = redisClient.connect()
      .then(() => redisClient)
      .catch((error) => {
        console.error('Failed to connect to Redis:', error);
        redisConnectPromise = null;
        return null;
      });
  }

  return redisConnectPromise;
};

const getRedisClient = () => {
  if (!redisClient || !redisClient.isReady) {
    return null;
  }

  return redisClient;
};

module.exports = { initRedis, getRedisClient };
