const mongoose = require("mongoose")

const User = mongoose.model(
    "User",
    new mongoose.Schema({
      username: String,
      email: String,
      password: String,
      isVerified: { type: Boolean, default: false },
      createdOn: Date,
    })
)

module.exports = User