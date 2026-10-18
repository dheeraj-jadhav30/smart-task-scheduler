import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true // Index makes queries by userId much faster
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending'
    },
    dueDate: {
      type: Date
    },
    reminderAt: {
      type: Date
    },
    reminderStatus: {
      type: String,
      enum: ['unscheduled', 'scheduled', 'processing', 'sent', 'failed', 'cancelled'],
      default: 'unscheduled'
    },
    reminderVersion: {
      type: Number,
      default: 0
    },
    reminderSentAt: {
      type: Date
    },
    lastReminderError: {
      type: String
    }
  },
  { timestamps: true }
);

// Compound index: makes searching user's tasks by status or priority super fast
taskSchema.index({ userId: 1, status: 1, priority: 1 });

const taskModel = mongoose.model('Task' , taskSchema)
export  default taskModel
