const mongoose = require("mongoose")

const Post = mongoose.model(
    "Post",
    new mongoose.Schema({
      editted: {
        type: Boolean,
        default: false
      },
      isMain: Boolean,
      title: String,
      image: String,
      body: String,
      imageURL: String,
      parent: { 
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'Post' 
      },
      replyingToUser: {
          type: mongoose.Schema.Types.ObjectId, 
          ref: 'User'
      },
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
      }
    })
)

module.exports = Post