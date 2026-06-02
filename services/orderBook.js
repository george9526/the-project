const Order = require('../models/Order');

const orderBooks = new Map();

async function buildOrderBook(symbol) {
  const buys = await Order.find({ symbol, type: 'buy', status: 'open' }).sort({ price: -1, createdAt: 1 }).lean();
  const sells = await Order.find({ symbol, type: 'sell', status: 'open' }).sort({ price: 1, createdAt: 1 }).lean();
  orderBooks.set(symbol, { buys, sells });
  return { buys, sells };
}

async function getOrderBook(symbol) {
  const cached = orderBooks.get(symbol);
  if (cached) return cached;
  return buildOrderBook(symbol);
}

function invalidateOrderBook(symbol) {
  orderBooks.delete(symbol);
}

async function emitOrderBook(io, symbol) {
  const book = await buildOrderBook(symbol);
  io.emit('orderbook', { symbol, ...book });
}

module.exports = { getOrderBook, buildOrderBook, invalidateOrderBook, emitOrderBook };
