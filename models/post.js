const mongoose = require("mongoose")

const Post = mongoose.model(
    "Post",
    new mongoose.Schema({
      title: String,
      image: String,
      body: String,
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      replies: [ { type: mongoose.Schema.Types.ObjectId, ref: 'Reply' }],
      createdOn: Date,
    })
)

module.exports = Post