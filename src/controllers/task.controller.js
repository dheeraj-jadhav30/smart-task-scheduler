import taskModel from '../models/task.model.js'
import { scheduleReminder , cancelReminder } from '../queues/reminder.queue.js';

export const createTask = async (req, res) => {
  try {
    const { title, description, priority, dueDate, reminderAt } = req.body;

    if (!title) {
      return res.status(400).json({
        message: 'Title is required'
      });
    }

    if (reminderAt && new Date(reminderAt) <= new Date()) {
      return res.status(400).json({
        message: 'Reminder time must be in future'
      });
    }

    const task = await taskModel.create({
      userId: req.user._id,
      title,
      description,
      priority,
      dueDate,
      reminderAt,
      reminderStatus: reminderAt ? 'scheduled' : 'unscheduled'
    });

    if(task.reminderAt) {
      try{
        await scheduleReminder(task)
      }catch(err) {
        console.error("failed to enqueue reminder job in redis",err.message)
      }
    }


    return res.status(201).json({
      success: true,
      data: task
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

export const getTasks = async (req, res) => {
  try {
    // 1. Read query parameters with fallback defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 2. Build the filter object (strictly scoped to logged-in user)
    const query = { userId: req.user._id };

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.priority) {
      query.priority = req.query.priority;
    }

    // 3. Fetch paginated tasks, newest first
    const tasks = await taskModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // 4. Count total matching tasks for pagination info
    const totalTasks = await taskModel.countDocuments(query);
    const totalPages = Math.ceil(totalTasks / limit);

    // 5. Send structured response
    return res.status(200).json({
      success: true,
      data: {
        tasks,
        pagination: {
          totalTasks,
          totalPages,
          currentPage: page,
          limit
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks',
      error: error.message
    });
  }
};


export const getTaskById = async (req, res) => {
  try {
    const task = await taskModel.findOne({ _id: req.params.id, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


export const updateTask = async (req , res) => {
try{


    const {title , description , priority , status , dueDate , reminderAt} = req.body
    

    const task = await taskModel.findOne({
        _id:req.params.id ,
        userId : req.user._id
    })

    if(!task) {
        return res.status(404).json({
            success:false ,
            message:"task not found"
        })
    }

    let reminderChanged = false 
    const oldVersion = task.reminderVersion 

    if(reminderAt) {
        if(new Date(reminderAt) <= new Date()) {
            return res.status(400).json({
                success:false ,
                message:"Reminder time must be in future"
            })
        }

        task.reminderAt = reminderAt 
        task.reminderStatus = 'scheduled'
        task.reminderVersion += 1 

        reminderChanged = true
    }


    
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority !== undefined) task.priority = priority;
    if (status !== undefined) task.status = status;
    if (dueDate !== undefined) task.dueDate = dueDate;

   await task.save()

   if(reminderChanged) {
    await cancelReminder(task._id , oldVersion)
    await scheduleReminder(task)
   }

   return res.status(200).json({
    success:true ,
    message:"task updated successfully",
    data:task
   })
   } catch(err) {
    return res.status(500).json({
        success:false ,
        message:err.message
    })
   }

}


export const completedTask = async (req , res) => {
    try{

      
        const task = await taskModel.findOne({
            _id:req.params.id ,
            userId:req.user._id
        })

        if(!task) {
            return res.status(404).json({ 
                success: false, message: 'Task not found' 
            });
        }

          task.status = 'completed' 
          task.reminderStatus = 'cancelled'

          await task.save()

          await cancelReminder(task._id, task.reminderVersion);

          return res.status(200).json({
            success:true ,
            message:"task marked as completed",
            data:task
          })
    }catch(err) {
        return res.status(500).json({
            success:false ,
            message:err.message
        })
    }

  

}


export const deleteTask = async (req, res) => {
  try {
    const task = await taskModel.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    await cancelReminder(task._id, task.reminderVersion);

    return res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};