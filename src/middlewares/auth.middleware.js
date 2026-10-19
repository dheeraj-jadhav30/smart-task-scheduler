import userModel from '../models/user.model.js'
import jwt from 'jsonwebtoken'


const authMiddleware = async (req , res , next) => {
    try{
        const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token

    if(!token) {
        return res.status(401).json({
            message:"token is missing"
        })
    }

    const decoded = jwt.verify(token , process.env.JWT_SECRET)

    const user = await userModel.findById(decoded.id).select('-password')

    if(!user) {
        return res.status(401).json({
            message:"Invalid token"
        })
    }

    req.user = user

    next()

    }catch(err) {
        return res.status(401).json({
            message:"Invalid or expired token"
        })
    }

}

export default authMiddleware