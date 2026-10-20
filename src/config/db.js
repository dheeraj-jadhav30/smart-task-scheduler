import mongoose from 'mongoose'

const connectDB = async () => {
    if (mongoose.connection.readyState >= 1) {
        return;
    }
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log('Mongodb connected')
    } catch(error) {
        console.log('MongoDb connection error', error.message)
        process.exit(1);
    }
}

export default connectDB