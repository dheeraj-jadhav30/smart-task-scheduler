import jwt from 'jsonwebtoken'
import userModel from '../models/user.model.js'

export const registerController = async (req , res) => {

    const {name , email , password} = req.body 

    if(!name || !email || !password) {
        return res.status(403).json({
            message:"All Fields are required"
        })
    }

    // check whether user is already present or not 

    const isUserAlreadyRegistered = await userModel.findOne({
        email:email
    })

    if(isUserAlreadyRegistered) {
        return res.status(400).json({
            message:"User is already registered"
        })
    }
    
    const user = await userModel.create({
        name:name ,
        email:email ,
        password:password
    })

    const token = jwt.sign({
       id: user._id,
    },process.env.JWT_SECRET)

    res. cookie("token" , token)

    return res.status(201).json({
        message:"User registered successfully ",
        data:{
            name:user.name ,
            email:user.email ,
        },
        token 
    })
} 


export const loginController = async (req , res) => {
    const {name , email , password} = req.body 

    if(!email || !password) {
        return res.status(403).json({
            message:"All fields are required"
        })
    }

    const user = await userModel.findOne({email})

    if(!user) {
        return res.status(401).json({
            message:"Unauthorized"
        })
    }

    const isMatch = await user.comparePassword(password)

    if(!isMatch) {
        return res.status(401).json({
            message:"Invalid credentials"
        })
    }

    const token = jwt.sign({
        id:user._id
    },process.env.JWT_SECRET)


    res.cookie("token" ,token)

    return res.status(200).json({
        message:"User logged in successfully",
        data:{
            id:user._id ,
            name :user.name ,
            email:user.email
        },
        token
    })
    
}

