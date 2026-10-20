import dotenv from 'dotenv';
dotenv.config();

import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';
import connectDB from '../src/config/db.js';
import redis from '../src/config/redis.js';
import userModel from '../src/models/user.model.js';
import taskModel from '../src/models/task.model.js';

describe('Smart Task Scheduler & Reminder System - Integration Tests', () => {
  let authToken = '';
  let createdTaskId = '';
  const testUser = {
    name: 'Test Runner',
    email: `test-${Date.now()}@example.com`,
    password: 'password123'
  };

  // 1. Establish database connection before running tests
  beforeAll(async () => {
    await connectDB();
  });

  // 2. Clean up test user and tasks, then close DB connections after tests complete
  afterAll(async () => {
    if (testUser.email) {
      const user = await userModel.findOne({ email: testUser.email });
      if (user) {
        await taskModel.deleteMany({ userId: user._id });
        await userModel.deleteOne({ _id: user._id });
      }
    }
    await mongoose.connection.close();
    await redis.quit();
  });

  // ==========================================
  // SUITE 1: OPERATIONAL HEALTH CHECKS
  // ==========================================
  describe('GET /health/live', () => {
    it('should return 200 and status UP for process liveness', async () => {
      const res = await request(app).get('/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('UP');
      expect(res.body).toHaveProperty('uptime');
    });
  });

  // ==========================================
  // SUITE 2: AUTHENTICATION & SECURITY
  // ==========================================
  describe('Authentication Flow (/api/auth)', () => {
    it('should register a new user successfully and return JWT token', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.data.email).toBe(testUser.email);
      authToken = res.body.token; // Save token for protected task tests
    });

    it('should reject duplicate email registration with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already registered/i);
    });

    it('should login with valid credentials and return 200 with JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.data.email).toBe(testUser.email);
    });

    it('should reject login with wrong password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'incorrectPassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid credentials/i);
    });
  });

  // ==========================================
  // SUITE 3: TASK CRUD & SECURITY SCOPING
  // ==========================================
  describe('Task Management Flow (/api/task)', () => {
    it('should reject task retrieval without Bearer token with 401', async () => {
      const res = await request(app).get('/api/task/get-tasks');
      expect(res.status).toBe(401);
    });

    it('should create a new task when authenticated', async () => {
      const res = await request(app)
        .post('/api/task/create-task')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Automated Test Task',
          description: 'Created by automated integration test suite',
          priority: 'high',
          dueDate: new Date(Date.now() + 86400000).toISOString()
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Automated Test Task');
      expect(res.body.data.priority).toBe('high');
      createdTaskId = res.body.data._id;
    });

    it('should retrieve paginated tasks for authenticated user', async () => {
      const res = await request(app)
        .get('/api/task/get-tasks?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.tasks)).toBe(true);
      expect(res.body.data.pagination.currentPage).toBe(1);
      expect(res.body.data.pagination.limit).toBe(5);
    });

    it('should fetch single task details by ID', async () => {
      const res = await request(app)
        .get(`/api/task/${createdTaskId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(createdTaskId);
    });

    it('should mark task as completed', async () => {
      const res = await request(app)
        .patch(`/api/task/${createdTaskId}/complete`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.reminderStatus).toBe('cancelled');
    });

    it('should delete task successfully', async () => {
      const res = await request(app)
        .delete(`/api/task/${createdTaskId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted successfully/i);
    });
  });
});
