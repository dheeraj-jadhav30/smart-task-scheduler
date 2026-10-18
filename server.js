import app from './app.js'
import connectDB from './src/config/db.js'
import dotenv from 'dotenv'
import redis from './src/config/redis.js'


dotenv.config() 



connectDB() 

app.listen(process.env.PORT , () => {
    console.log('server is connected')
})

