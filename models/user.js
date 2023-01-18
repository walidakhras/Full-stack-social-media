const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    username: {
      type: String,
      maxLength: 30
    },
    email: String,
    password: String,
    bio: {
      type: String,
      default: null,
      maxLength: 300
    },
    isVerified: { type: Boolean, default: false },
    createdOn: {
      type: Date,
      default: Date.now
    },
    image: String,
    imageURL: String,
    favorites: [
      {
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Post' 
      }
    ]
})



module.exports = mongoose.model('User', userSchema)