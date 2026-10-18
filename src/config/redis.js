import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL,
    {
        maxRetriesPerRequest:null
    }
)

redis.on('connect' , () => {
    console.log('Redis connected')
})

redis.on('error' , (error) => {
    console.log('error occured while connecting to redis',error.message )
})

export default redis