const express = require('express');
const Order = require('../models/Order');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { processOrder } = require('../services/matchingEngine');
const router = express.Router();

let ioRef;
function setSocketIO(io) { ioRef = io; }
function getIO() { return ioRef; }

router.post('/', auth, async (req, res) => {
  try {
    const result = await processOrder({ ...req.body, userId: req.user.id }, getIO());
    if (result.error) return res.status(400).json({ error: result.error });
    res.status(201).json({
      message: 'Order processed',
      order: result.order,
      matches: result.matches,
      updatedBalance: result.updatedBalance,
      updatedPortfolio: result.updatedPortfolio
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process order', details: error.message });
  }
});

router.get('/active', auth, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id, status: 'open' }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user.id, status: 'open' });
    if (!order) return res.status(404).json({ error: 'Order not found or already executed' });

    const user = await User.findById(req.user.id);
    const refundAmount = order.filled > 0
      ? (order.amount - order.filled) * order.price
      : order.amount * order.price;

    if (order.type === 'buy') {
      user.balance += refundAmount;
    } else {
      user.portfolio.set(order.symbol, (user.portfolio.get(order.symbol) || 0) + (order.amount - order.filled));
    }

    order.status = 'canceled';
    await order.save();
    await user.save();

    const { invalidateOrderBook } = require('../services/orderBook');
    invalidateOrderBook(order.symbol);

    if (getIO()) {
      getIO().emit('portfolio_update', {
        userId: String(user._id),
        balance: user.balance,
        portfolio: Object.fromEntries(user.portfolio)
      });
    }

    res.json({ message: 'Order canceled', order });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel order', details: error.message });
  }
});

module.exports = { router, setSocketIO };
