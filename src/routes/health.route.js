import express from 'express';
import mongoose from 'mongoose';
import redis from '../config/redis.js';

const healthRouter = express.Router();

// Liveness Probe: Checks if the server process is responsive
healthRouter.get('/live', (req, res) => {
  return res.status(200).json({
    status: 'UP',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Readiness Probe: Verifies both MongoDB and Redis connections
healthRouter.get('/ready', async (req, res) => {
  const isMongoReady = mongoose.connection.readyState === 1;
  let isRedisReady = false;

  try {
    const pong = await redis.ping();
    isRedisReady = pong === 'PONG';
  } catch (error) {
    isRedisReady = false;
  }

  const allDependenciesReady = isMongoReady && isRedisReady;

  return res.status(allDependenciesReady ? 200 : 503).json({
    status: allDependenciesReady ? 'READY' : 'DEGRADED',
    dependencies: {
      mongodb: isMongoReady ? 'CONNECTED' : 'DISCONNECTED',
      redis: isRedisReady ? 'CONNECTED' : 'DISCONNECTED'
    },
    timestamp: new Date().toISOString()
  });
});

export default healthRouter;
