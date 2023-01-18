const mongoose = require("mongoose")

const Post = mongoose.model(
    "Post",
    new mongoose.Schema({
      editted: {
        type: Boolean,
        default: false
      },
      isMain: Boolean,
      title: {
        type: String,
        maxLength: 100
      },
      image: String,
      body: {
        type: String,
        maxLength: 5000
      },
      imageURL: String,
      parent: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Post' 
      },
      replyingToUser: {
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'User'
      },
      replyingToUsername: String,
      author: {  
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'User' 
      },
      replies: [
        {
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Post' 
        }
      ],
      createdOn: {
        type: Date,
        default: Date.now
      },
      views: {
        type: Number,
        default: 1
      },
      username: String
    })
)

module.exports = Post