const mongoose = require("mongoose")

const Reply = mongoose.model(
    "Reply",
    new mongoose.Schema({
      body: String,
      author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdOn: Date,
    })
)

module.exports = Reply