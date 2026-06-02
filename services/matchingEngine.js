const Order = require('../models/Order');
const Trade = require('../models/Trade');
const User = require('../models/User');
const { invalidateOrderBook } = require('./orderBook');

async function processOrder(orderData, io) {
  const { userId, symbol, type, amount, price, orderType } = orderData;
  const upperSymbol = symbol.toUpperCase();

  if (orderType === 'limit' && (!price || price <= 0)) {
    return { error: 'Limit orders require a valid price' };
  }
  if (!amount || amount <= 0) {
    return { error: 'Amount must be positive' };
  }

  const user = await User.findById(userId);
  if (!user) return { error: 'User not found' };

  const totalCost = amount * (price || 0);
  if (type === 'buy' && orderType === 'limit' && user.balance < totalCost) {
    return { error: 'Insufficient funds! You have $' + user.balance.toLocaleString() };
  }
  if (type === 'sell') {
    const assetQty = user.portfolio.get(upperSymbol) || 0;
    if (assetQty < amount) {
      return { error: 'Insufficient assets! You own ' + assetQty + ' units of ' + upperSymbol };
    }
  }

  const newOrder = new Order({
    user: userId, username: user.username, symbol: upperSymbol,
    type, amount, price: price || 0, status: 'open', orderType: orderType || 'limit'
  });

  let remainingAmount = amount;
  let matches = [];

  if (type === 'buy' && orderType === 'market') {
    const sellOrders = await Order.find({
      symbol: upperSymbol, type: 'sell', status: 'open'
    }).sort({ price: 1, createdAt: 1 });

    for (const sellOrder of sellOrders) {
      if (remainingAmount <= 0) break;
      const tradeAmount = Math.min(remainingAmount, sellOrder.amount - sellOrder.filled);
      const tradePrice = sellOrder.price;
      const tradeCost = tradeAmount * tradePrice;
      if (user.balance < tradeCost) break;

      remainingAmount -= tradeAmount;
      newOrder.filled += tradeAmount;
      sellOrder.filled += tradeAmount;
      if (newOrder.filled >= newOrder.amount) newOrder.status = 'fulfilled';
      if (sellOrder.filled >= sellOrder.amount) sellOrder.status = 'fulfilled';
      await sellOrder.save();

      user.balance -= tradeCost;
      user.portfolio.set(upperSymbol, (user.portfolio.get(upperSymbol) || 0) + tradeAmount);

      const seller = await User.findById(sellOrder.user);
      seller.balance += tradeCost;
      seller.portfolio.set(upperSymbol, Math.max(0, (seller.portfolio.get(upperSymbol) || 0) - tradeAmount));
      await seller.save();
      matches.push({ tradeAmount, tradePrice });
    }
  } else if (type === 'sell' && orderType === 'market') {
    const buyOrders = await Order.find({
      symbol: upperSymbol, type: 'buy', status: 'open'
    }).sort({ price: -1, createdAt: 1 });

    for (const buyOrder of buyOrders) {
      if (remainingAmount <= 0) break;
      const tradeAmount = Math.min(remainingAmount, buyOrder.amount - buyOrder.filled);
      const tradePrice = buyOrder.price;
      remainingAmount -= tradeAmount;
      newOrder.filled += tradeAmount;
      buyOrder.filled += tradeAmount;
      if (newOrder.filled >= newOrder.amount) newOrder.status = 'fulfilled';
      if (buyOrder.filled >= buyOrder.amount) buyOrder.status = 'fulfilled';
      await buyOrder.save();

      user.balance += tradeAmount * tradePrice;
      user.portfolio.set(upperSymbol, Math.max(0, (user.portfolio.get(upperSymbol) || 0) - tradeAmount));

      const buyer = await User.findById(buyOrder.user);
      buyer.balance -= tradeAmount * tradePrice;
      buyer.portfolio.set(upperSymbol, (buyer.portfolio.get(upperSymbol) || 0) + tradeAmount);
      await buyer.save();
      matches.push({ tradeAmount, tradePrice });
    }
  } else {
    const oppositeType = type === 'buy' ? 'sell' : 'buy';
    const matchQuery = { symbol: upperSymbol, type: oppositeType, status: 'open' };
    if (type === 'buy') matchQuery.price = { '$lte': price };
    if (type === 'sell') matchQuery.price = { '$gte': price };
    const sortOrder = type === 'buy' ? { price: 1 } : { price: -1 };
    const openOrders = await Order.find(matchQuery).sort(sortOrder);

    for (const matchOrder of openOrders) {
      if (remainingAmount <= 0) break;
      const tradeAmount = Math.min(remainingAmount, matchOrder.amount - matchOrder.filled);
      const tradePrice = matchOrder.price;
      remainingAmount -= tradeAmount;
      newOrder.filled += tradeAmount;
      matchOrder.filled += tradeAmount;
      if (newOrder.filled >= newOrder.amount) newOrder.status = 'fulfilled';
      if (matchOrder.filled >= matchOrder.amount) matchOrder.status = 'fulfilled';
      await matchOrder.save();

      const matchUser = await User.findById(matchOrder.user);
      if (type === 'buy') {
        user.balance -= tradeAmount * tradePrice;
        user.portfolio.set(upperSymbol, (user.portfolio.get(upperSymbol) || 0) + tradeAmount);
        matchUser.balance += tradeAmount * tradePrice;
        matchUser.portfolio.set(upperSymbol, Math.max(0, (matchUser.portfolio.get(upperSymbol) || 0) - tradeAmount));
      } else {
        user.balance += tradeAmount * tradePrice;
        user.portfolio.set(upperSymbol, Math.max(0, (user.portfolio.get(upperSymbol) || 0) - tradeAmount));
        matchUser.balance -= tradeAmount * tradePrice;
        matchUser.portfolio.set(upperSymbol, (matchUser.portfolio.get(upperSymbol) || 0) + tradeAmount);
      }
      await matchUser.save();
      matches.push({ tradeAmount, tradePrice });
    }
  }

  if (remainingAmount > 0 && orderType === 'limit') {
    newOrder.amount = remainingAmount;
    newOrder.filled = 0;
    newOrder.status = 'open';
    await newOrder.save();
  } else if (remainingAmount > 0) {
    newOrder.amount = amount - remainingAmount;
    newOrder.filled = amount - remainingAmount;
    if (newOrder.filled > 0) await newOrder.save();
  } else {
    await newOrder.save();
  }

  await user.save();

  for (const m of matches) {
    const trade = await Trade.create({
      symbol: upperSymbol, type, amount: m.tradeAmount,
      price: m.tradePrice, user: user.username
    });
    if (io) io.emit('new_trade', trade);
  }

  invalidateOrderBook(upperSymbol);
  if (matches.length > 0 && io) {
    const freshUser = await User.findById(userId);
    io.emit('portfolio_update', {
      userId: String(freshUser._id),
      balance: freshUser.balance,
      portfolio: Object.fromEntries(freshUser.portfolio)
    });
  }

  const finalUser = await User.findById(userId);
  return {
    order: newOrder,
    matches: matches.map(m => ({ amount: m.tradeAmount, price: m.tradePrice })),
    updatedBalance: finalUser.balance,
    updatedPortfolio: Object.fromEntries(finalUser.portfolio)
  };
}

module.exports = { processOrder };
