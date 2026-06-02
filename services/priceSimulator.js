const Asset = require('../models/Asset');

const INITIAL_ASSETS = [
  { symbol: 'TECH', name: 'TechCorp', price: 150.00 },
  { symbol: 'ENERGY', name: 'Energy Inc', price: 85.50 },
  { symbol: 'FIN', name: 'Finance Group', price: 220.00 },
  { symbol: 'HEALTH', name: 'HealthPlus', price: 310.25 },
  { symbol: 'CONS', name: 'Consumer Goods Co', price: 45.75 }
];

function randomWalk(currentPrice, volatility = 0.02) {
  const change = currentPrice * volatility * (Math.random() - 0.5) * 2;
  const newPrice = Math.max(0.01, currentPrice + change);
  return Math.round(newPrice * 100) / 100;
}

async function seedAssets() {
  for (const a of INITIAL_ASSETS) {
    const exists = await Asset.findOne({ symbol: a.symbol });
    if (!exists) {
      await Asset.create({ ...a, previousPrice: a.price, high: a.price, low: a.price });
    }
  }
}

function startPriceSimulation(io, intervalMs = 2000) {
  setInterval(async () => {
    try {
      const assets = await Asset.find();
      for (const asset of assets) {
        asset.previousPrice = asset.price;
        asset.price = randomWalk(asset.price);
        asset.change = Math.round((asset.price - asset.previousPrice) * 100) / 100;
        asset.changePercent = Math.round((asset.change / asset.previousPrice) * 10000) / 100;
        if (asset.price > asset.high) asset.high = asset.price;
        if (asset.price < asset.low) asset.low = asset.price;
        await asset.save();
      }
      io.emit('prices', assets.map(a => ({
        symbol: a.symbol, name: a.name, price: a.price,
        previousPrice: a.previousPrice, change: a.change,
        changePercent: a.changePercent, high: a.high, low: a.low, volume: a.volume
      })));
    } catch (err) {
      console.error('Price sim error:', err.message);
    }
  }, intervalMs);
}

module.exports = { seedAssets, startPriceSimulation };
