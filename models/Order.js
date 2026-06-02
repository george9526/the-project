const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  username: { 
    type: String, 
    required: true 
  }, // لتسهيل عرض الاسم في الواجهة
  symbol: { 
    type: String, 
    required: true, 
    uppercase: true 
  }, // مثل BTC
  type: { 
    type: String, 
    required: true, 
    enum: ['buy', 'sell'] 
  },
  amount: { 
    type: Number, 
    required: true 
  }, // الكمية المطلوبة
  filled: { 
    type: Number, 
    default: 0 
  }, 
  price: { 
    type: Number, 
    required: true 
  },
  status: { 
    type: String, 
    default: 'open', 
    enum: ['open', 'fulfilled', 'canceled'] 
  } 
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);