import express from 'express'
import authMiddleware from '../middlewares/auth.middleware.js'
import * as taskController from '../controllers/task.controller.js'


const taskRouter = express.Router()

taskRouter.use(authMiddleware)

taskRouter.post('/create-task', taskController.createTask);

taskRouter.get('/get-tasks', taskController.getTasks);

taskRouter.get('/:id', taskController.getTaskById);

taskRouter.patch('/:id', taskController.updateTask);

taskRouter.patch('/:id/complete', taskController.completedTask);

taskRouter.delete('/:id', taskController.deleteTask)

export default taskRouter