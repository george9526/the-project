const express = require('express');
const Asset = require('../models/Asset');
const { getOrderBook } = require('../services/orderBook');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const assets = await Asset.find().sort({ symbol: 1 });
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

router.get('/:symbol/orderbook', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const book = await getOrderBook(symbol);
    res.json({ symbol, ...book });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch order book' });
  }
});

module.exports = router;
