const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { getRedisClient } = require('../redisClient');

// Generic API Rate Limiter (e.g. max 150 requests per 15 minutes)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // Limit each IP to 150 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  },
  // store: new RedisStore({
  //   prefix: 'rl:api:',
  //   // @ts-expect-error
  //   sendCommand: (...args) => {
  //     const redisClient = getRedisClient();
  //     if (redisClient) {
  //       // node-redis v4 requires all arguments to be strings
  //       const stringArgs = args.map(String);
  //       return redisClient.sendCommand(stringArgs);
  //     }
  //     return Promise.reject(new Error('Redis not connected'));
  //   },
  // }),
});

// Strict Auth Rate Limiter (prevents brute force password attacks)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login/signup requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again after 15 minutes.'
  },
  // store: new RedisStore({
  //   prefix: 'rl:auth:',
  //   // @ts-expect-error
  //   sendCommand: (...args) => {
  //     const redisClient = getRedisClient();
  //     if (redisClient) {
  //       // node-redis v4 requires all arguments to be strings
  //       const stringArgs = args.map(String);
  //       return redisClient.sendCommand(stringArgs);
  //     }
  //     return Promise.reject(new Error('Redis not connected'));
  //   },
  // }),
});

module.exports = { apiLimiter, authLimiter };
