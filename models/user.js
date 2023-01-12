const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    isVerified: { type: Boolean, default: false },
    createdOn: {
      type: Date,
      default: Date.now
    },
    image: String,
    imageURL: String
})



module.exports = mongoose.model('User', userSchema)