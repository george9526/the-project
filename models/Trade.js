const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  symbol: { 
    type: String, 
    required: true, 
    uppercase: true
  },
  type: { 
    type: String, 
    required: true, 
    enum: ['buy', 'sell']
  },
  amount: { 
    type: Number, 
    required: true
  },
  price: { 
    type: Number, 
    required: true
  },
  user: { 
    type: String, 
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Trade', tradeSchema);