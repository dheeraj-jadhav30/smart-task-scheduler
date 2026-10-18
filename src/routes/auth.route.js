import express  from 'express'
import * as authController from '../controllers/auth.controller.js'
const authRouter = express.Router() 

authRouter.post('/register' , authController.registerController)

authRouter.post('/login' , authController.loginController)


export default authRouter