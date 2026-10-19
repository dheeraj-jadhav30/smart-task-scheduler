import express from 'express' 
import authRouter from './src/routes/auth.route.js'
import taskRouter from './src/routes/task.route.js'
import healthRouter from './src/routes/health.route.js'
import cookieParser from 'cookie-parser'

const app = express() 

app.use(express.json())
app.use(cookieParser())

// routes
app.use('/health', healthRouter);
app.use('/api/auth' , authRouter)
app.use('/api/task' , taskRouter)

export default app