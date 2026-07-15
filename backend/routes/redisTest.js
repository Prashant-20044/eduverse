const express = require('express');
const router = express.Router();
const { initRedis } = require('../redisClient');
const { cacheMiddleware } = require('../middleware/cache');

router.get('/test', async (req, res) => {
  try {
    const client = await initRedis();

    if (!client) {
      return res.status(500).json({
        success: false,
        message: 'Redis is not configured or reachable.',
      });
    }

    const key = `coaching:health:${Date.now()}`;
    await client.set(key, 'ok');
    const value = await client.get(key);
    await client.del(key);

    return res.json({
      success: true,
      connected: true,
      key,
      value,
    });
  } catch (error) {
    console.error('Redis test route error:', error);
    return res.status(500).json({
      success: false,
      message: 'Redis test failed.',
      error: error.message,
    });
  }
});

router.get('/cache-demo', cacheMiddleware('redis_demo'), async (req, res) => {
  res.json({
    success: true,
    message: 'Redis cache middleware demo',
    timestamp: Date.now(),
  });
});

module.exports = router;
