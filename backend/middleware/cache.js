const { getRedisClient } = require('../redisClient');

const cacheMiddleware = (keyPrefix) => {
  return async (req, res, next) => {
    const redis = getRedisClient();
    if (!redis) {
      return next(); // Fallback to DB if Redis is not connected
    }

    // e.g. cacheKey could be 'cache:live_classes:teacherId' or just 'cache:live_classes'
    let cacheKey = `cache:${keyPrefix}`;
    if (req.user && req.user.role === 'student' && req.user.teacherId) {
       cacheKey += `:${req.user.teacherId.toString()}`;
    }

    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        console.log(`[Redis] Cache HIT for key: ${cacheKey}`);
        return res.json(JSON.parse(cachedData));
      }
      
      console.log(`[Redis] Cache MISS for key: ${cacheKey}`);
      // Override res.json to capture the response and save it to Redis
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (body.success) {
          // Cache for 60 seconds (or appropriate TTL)
          redis.setEx(cacheKey, 60, JSON.stringify(body))
            .catch(err => console.error('Redis Set Error:', err));
        }
        return originalJson(body);
      };
      
      next();
    } catch (err) {
      console.error('Redis Cache Middleware Error:', err);
      next();
    }
  };
};

const invalidateCache = async (keyPrefix) => {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    // We can use SCAN or KEYS to find all keys matching the prefix, 
    // or just delete known patterns. For simplicity, delete wildcard.
    const keys = await redis.keys(`cache:${keyPrefix}*`);
    if (keys.length > 0) {
      await redis.del(keys);
      console.log(`[Redis] Invalidated cache keys matching: cache:${keyPrefix}*`);
    }
  } catch (err) {
    console.error('Redis Cache Invalidation Error:', err);
  }
};

module.exports = { cacheMiddleware, invalidateCache };
