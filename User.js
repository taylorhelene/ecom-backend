const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email : {type : String },
    name : String,
    password : String,
    role : { type: String, default: "user" } // "admin" or "user"
})
const User = mongoose.model("User", UserSchema);
module.exports={User}