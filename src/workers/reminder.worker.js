import { Worker } from "bullmq";
import redis from "../config/redis.js";
import taskModel from "../models/task.model.js";
import connectDB from "../config/db.js";
import dotenv from "dotenv";

dotenv.config();

// Connect to MongoDB so the worker can query and update tasks
connectDB();

console.log("👷 [BullMQ] Reminder Worker started and waiting for jobs...");

export const reminderWorker = new Worker("reminderQueue", async (job) => {
  const { taskId, version } = job.data;

  console.log(
    `\n🔔 [Worker] Processing reminder for Job [${job.id}] (Task: ${taskId}, Version: ${version})`,
  );

  const task = await taskModel.findById(taskId);

  if (!task) {
    console.log(`⚠️ [Worker] Task [${taskId}] no longer exists. Skipping.`);
    return { skipped: true, reason: "task deleted" };
  }

  if (task.status === "completed") {
    console.log(
      `✅ [Worker] Task [${taskId}] is already completed. Skipping reminder.`,
    );
    return { skipped: true, reason: "Task already completed" };
  }

  if (task.reminderStatus === "cancelled") {
    console.log(
      `🚫 [Worker] Reminder for Task [${taskId}] was cancelled. Skipping.`,
    );
    return { skipped: true, reason: "Reminder cancelled" };
  }

  if (task.reminderVersion !== version) {
    console.log(
      `🔄 [Worker] Stale reminder version (Current: v${task.reminderVersion}, Job: v${version}). Skipping.`,
    );
    return { skipped: true, reason: "Superseded by newer reminder" };
  }

  (task.reminderStatus = "processing")
   await task.save()

  try {
    // 7. Simulate Notification Delivery (Email / Push / SMS)
    console.log(
      `📧 [Notification Sent] >>> Reminder: "${task.title}" (Priority: ${task.priority}) is due on ${task.dueDate || "N/A"}`,
    );
    // 8. Mark as sent in MongoDB
    task.reminderStatus = "sent";
    task.reminderSentAt = new Date();
    task.lastReminderError = null;
    await task.save();
    console.log(
      `🎉 [Worker] Reminder successfully marked as 'sent' for Task [${taskId}]`,
    );
    return { success: true };
  } catch (error) {
    // 9. Record error on task and rethrow so BullMQ triggers retry policy
    task.lastReminderError = error.message;
    await task.save();
    throw error;
  }
},{
    connection: redis,
    concurrency: 3 // Can process up to 5 reminders simultaneously
  });


  reminderWorker.on('completed', (job) => {
  console.log(`🏁 [BullMQ] Job [${job.id}] completed successfully.`);
});
reminderWorker.on('failed', async (job, err) => {
  console.error(`💥 [BullMQ] Job [${job?.id}] failed. Error: ${err.message}`);
  
  // If all retry attempts are exhausted, record failure on task
  if (job && job.attemptsMade >= job.opts.attempts) {
    console.error(`🚨 [BullMQ] Job [${job.id}] exhausted all ${job.opts.attempts} retries! Marking task as failed.`);
    await taskModel.findByIdAndUpdate(job.data.taskId, {
      reminderStatus: 'failed',
      lastReminderError: `Exhausted all retries: ${err.message}`
    });
  }
});
