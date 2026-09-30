const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    default: 10000 
  },
  portfolio: {
    type: Map,
    of: Number,
    default: {} 
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);