import mongoose from 'mongoose' 
import bcrypt from 'bcrypt'
import { minLength } from 'zod'

const userSchema = new mongoose.Schema({
    name:{
        type:String ,
        required:[true , "name is required"],
        trim:true
    },

    email:{
        type:String ,
        required:[true , 'Email is required'],
        unique:true ,
        lowercase:true ,
        trim:true
    },

    password:{
        type:String ,
        required:[true ,'password is required'],
        minlength:[6 , "Password must be at least 6 characters"]
    }
} , { 
    timestamps:true 
})


userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return ;
  this.password = await bcrypt.hash(this.password, 10);
  
});


userSchema.methods.comparePassword = async function(password) {
    return await bcrypt.compare(password , this.password)

}

const userModel = mongoose.model('User' , userSchema)

export default userModel

