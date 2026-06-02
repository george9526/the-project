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
  // إضافة الرصيد الافتراضي 10,000 دولار حسب متطلبات الجامعة
  balance: {
    type: Number,
    default: 10000 
  },
  // المحفظة الافتراضية (تحفظ كمية الأسهم التي يملكها من كل شركة)
  portfolio: {
    type: Map,
    of: Number,
    default: {} 
  }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);