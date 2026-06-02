const express = require('express');
const User = require('../models/User');
const Trade = require('../models/Trade');
const Asset = require('../models/Asset');
const auth = require('../middleware/auth');
const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const assets = await Asset.find();
    const priceMap = {};
    for (const a of assets) priceMap[a.symbol] = a.price;

    let totalValue = user.balance;
    const holdings = [];
    for (const [symbol, qty] of user.portfolio) {
      if (qty > 0) {
        const currentPrice = priceMap[symbol] || 0;
        totalValue += qty * currentPrice;
        holdings.push({ symbol, quantity: qty, currentPrice, value: qty * currentPrice });
      }
    }

    res.json({
      balance: user.balance,
      totalValue: Math.round(totalValue * 100) / 100,
      holdings,
      portfolio: Object.fromEntries(user.portfolio)
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

router.get('/trades', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const trades = await Trade.find({ user: user.username }).sort({ createdAt: -1 }).limit(50);
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trade history' });
  }
});

module.exports = router;
