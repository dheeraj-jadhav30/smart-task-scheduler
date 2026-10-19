import dotenv from 'dotenv';
import mongoose from 'mongoose';
import userModel from './models/user.model.js';
import taskModel from './models/task.model.js';

dotenv.config();

const seedData = async () => {
  try {
    console.log('🌱 Connecting to MongoDB to seed data...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Clean existing users and tasks (fresh start)
    await userModel.deleteMany({});
    await taskModel.deleteMany({});
    console.log('🧹 Cleared existing users and tasks');

    // 2. Create 2 test users
    // Note: your pre('save') hook will automatically hash these passwords!
    const alice = await userModel.create({
      name: 'Alice Johnson',
      email: 'alice@example.com',
      password: 'password123'
    });

    const bob = await userModel.create({
      name: 'Bob Smith',
      email: 'bob@example.com',
      password: 'password123'
    });

    console.log('👤 Created test users:');
    console.log('   - alice@example.com (password: password123)');
    console.log('   - bob@example.com (password: password123)');

    // 3. Create varied tasks for Alice (to test pagination and filters)
    const now = new Date();

    const tasksForAlice = [
      {
        userId: alice._id,
        title: 'Complete System Architecture Diagram',
        description: 'Draw detailed diagrams for API, Worker, Redis, and Mongo interaction',
        priority: 'high',
        status: 'in-progress',
        dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // in 2 days
        reminderAt: new Date(now.getTime() + 10 * 60 * 1000), // in 10 minutes
        reminderStatus: 'scheduled'
      },
      {
        userId: alice._id,
        title: 'Fix Redis Connection on Docker',
        description: 'Ensure maxRetriesPerRequest is set to null for BullMQ compatibility',
        priority: 'high',
        status: 'completed',
        dueDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // yesterday
        reminderStatus: 'cancelled'
      },
      {
        userId: alice._id,
        title: 'Implement BullMQ Worker Service',
        description: 'Write the worker consumer with idempotency and state verification',
        priority: 'high',
        status: 'pending',
        dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // tomorrow
        reminderAt: new Date(now.getTime() + 30 * 60 * 1000), // in 30 minutes
        reminderStatus: 'scheduled'
      },
      {
        userId: alice._id,
        title: 'Review PR for Authentication Middleware',
        description: 'Verify token expiration and bearer extraction logic',
        priority: 'medium',
        status: 'completed',
        dueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        reminderStatus: 'unscheduled'
      },
      {
        userId: alice._id,
        title: 'Set up Postman Collection',
        description: 'Add tests and pre-request scripts for automatic token passing',
        priority: 'medium',
        status: 'in-progress',
        dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
        reminderAt: new Date(now.getTime() + 60 * 60 * 1000), // in 1 hour
        reminderStatus: 'scheduled'
      },
      {
        userId: alice._id,
        title: 'Write Unit Tests for Date Validation',
        description: 'Ensure reminder time cannot be in the past',
        priority: 'medium',
        status: 'pending',
        dueDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000),
        reminderStatus: 'unscheduled'
      },
      {
        userId: alice._id,
        title: 'Configure Helmet and Rate Limiting',
        description: 'Add security headers and rate limiter on auth routes',
        priority: 'low',
        status: 'pending',
        dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        reminderStatus: 'unscheduled'
      },
      {
        userId: alice._id,
        title: 'Refactor Environment Variables to Zod Schema',
        description: 'Ensure fail-fast behavior when missing secrets',
        priority: 'low',
        status: 'pending',
        dueDate: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
        reminderStatus: 'unscheduled'
      },
      {
        userId: alice._id,
        title: 'Draft Project README Documentation',
        description: 'Document architectural decisions and Docker setup instructions',
        priority: 'medium',
        status: 'in-progress',
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        reminderStatus: 'unscheduled'
      },
      {
        userId: alice._id,
        title: 'Explore Upstash Redis Cloud Alternative',
        description: 'Test cloud Redis connectivity without requiring local Docker daemon',
        priority: 'low',
        status: 'completed',
        dueDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
        reminderStatus: 'unscheduled'
      },
      {
        userId: alice._id,
        title: 'Prepare Resume Bullet Points',
        description: 'Highlight idempotency, versioning, and delayed queues using STAR format',
        priority: 'high',
        status: 'pending',
        dueDate: new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000),
        reminderAt: new Date(now.getTime() + 120 * 60 * 1000), // in 2 hours
        reminderStatus: 'scheduled'
      },
      {
        userId: alice._id,
        title: 'Record Demo Walkthrough Video',
        description: 'Show delayed job execution and recovery when worker restarts',
        priority: 'medium',
        status: 'pending',
        dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        reminderStatus: 'unscheduled'
      }
    ];

    await taskModel.insertMany(tasksForAlice);
    console.log(`📋 Inserted ${tasksForAlice.length} tasks for Alice`);

    // 4. Create 2 tasks for Bob (to verify data isolation between users)
    const tasksForBob = [
      {
        userId: bob._id,
        title: "Bob's Secret Task",
        description: 'Alice must never see this task in her API response!',
        priority: 'high',
        status: 'pending'
      },
      {
        userId: bob._id,
        title: "Bob's Code Review",
        description: 'Review frontend integration PR',
        priority: 'low',
        status: 'in-progress'
      }
    ];

    await taskModel.insertMany(tasksForBob);
    console.log(`📋 Inserted ${tasksForBob.length} tasks for Bob`);

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

seedData();
