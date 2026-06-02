const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  symbol: { 
    type: String, 
    required: true, 
    uppercase: true // مثل: BTC, AAPL, EURUSD
  },
  type: { 
    type: String, 
    required: true, 
    enum: ['buy', 'sell'] // يجب أن تكون الصفقة إما شراء أو بيع فقط
  },
  amount: { 
    type: Number, 
    required: true // الكمية المراد تداولها
  },
  price: { 
    type: Number, 
    required: true // السعر عند تنفيذ الصفقة
  },
  user: { 
    type: String, 
    required: true // اسم المستخدم الذي قام بالصفقة
  }
}, { timestamps: true });

module.exports = mongoose.model('Trade', tradeSchema);