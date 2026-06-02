const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  symbol: { type: String, required: true, uppercase: true },
  type: { type: String, required: true, enum: ['buy', 'sell'] },
  orderType: { type: String, default: 'limit', enum: ['limit', 'market'] },
  amount: { type: Number, required: true },
  filled: { type: Number, default: 0 },
  price: { type: Number, default: 0 },
  status: { type: String, default: 'open', enum: ['open', 'fulfilled', 'canceled'] }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
