import app from './app.js'
import connectDB from './src/config/db.js'
import dotenv from 'dotenv'
import redis from './src/config/redis.js'

// 🚀 Start BullMQ reminder worker alongside Express server (Single-service deployment)
import './src/workers/reminder.worker.js'

dotenv.config() 

connectDB() 

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}`)
})

