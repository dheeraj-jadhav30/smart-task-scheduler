import {Queue} from 'bullmq'

import redis from '../config/redis.js'


export const reminderQueue = new Queue('reminderQueue', {
    connection:redis,
    defaultJobOptions :{
        attempts:3 ,
        backoff :{
            type:'exponential',
            delay:5000
        },
        removeOnComplete:true ,
        removeOnFail:false
    }
});


export const scheduleReminder = async (task) => {

    if(!task.reminderAt) return null ;

    const delay = Math.max(0 , new Date(task.reminderAt).getTime() - Date.now());

    const jobId =  `task-${task._id}-v${task.reminderVersion}`

    const job = await reminderQueue.add('send-reminder', {
        taskId : task._id.toString() ,
        version:task.reminderVersion
    },{
        jobId ,
        delay
    })

    console.log(`⏰ [BullMQ] Scheduled job [${jobId}] to run in ${Math.round(delay / 1000)}s`);
    return job;

}


export const cancelReminder  = async (taskId , version) => {
    
    try{
         const jobId =  `task-${taskId}-v${version}`

         const job = await reminderQueue.getJob(jobId)

         if(job) {
            await job.remove()

            console.log(`🚫 [BullMQ] Cancelled & removed job [${jobId}] from queue`);
         }
    }catch(err) {
        console.error(`❌ [BullMQ] Failed to cancel job for task [${taskId}]:`, err.message);
    }
}