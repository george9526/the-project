const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http'); 
const { Server } = require('socket.io'); 
require('dotenv').config();

const User = require('./models/User');
const Trade = require('./models/Trade'); 
const Order = require('./models/Order'); 

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

io.on('connection', (socket) => {
  console.log('⚡ A user connected:', socket.id);
  socket.on('disconnect', () => console.log('❌ User disconnected:', socket.id));
});

// --- AUTHENTICATION ---
app.post('/api/users/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({ username, email, password: hashedPassword });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Failed to register", details: error.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "User not found!" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid password!" });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    res.status(200).json({ 
      message: "Login successful!", 
      token, 
      user: { id: user._id, username: user.username, balance: user.balance, portfolio: user.portfolio } 
    });
  } catch (error) {
    res.status(500).json({ error: "Login failed", details: error.message });
  }
});

// --- TRADES ---
app.get('/api/trades', async (req, res) => {
  try {
    const trades = await Trade.find().sort({ createdAt: -1 }).limit(20);
    res.status(200).json(trades);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch trades", details: error.message });
  }
});

// --- MATCHING ENGINE ---
app.post('/api/orders', async (req, res) => {
  try {
    const { userId, symbol, type, amount, price } = req.body;
    const upperSymbol = symbol.toUpperCase();
    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // فحص 1: رصيد غير كافي للشراء
    const totalCost = amount * price;
    if (type === 'buy' && user.balance < totalCost) {
      return res.status(400).json({ error: "Insufficient funds! You don't have enough money." });
    }

    // فحص 2: أصول غير كافية للبيع (تمت إضافته لحل مشكلتك الحالية)
    if (type === 'sell') {
      const assetQty = user.portfolio.get(upperSymbol) || 0;
      if (assetQty < amount) {
        return res.status(400).json({ error: `Insufficient assets! You own ${assetQty} units of ${upperSymbol}.` });
      }
    }

    let newOrder = new Order({ user: userId, username: user.username, symbol: upperSymbol, type, amount, price });
    await newOrder.save();

    const oppositeType = type === 'buy' ? 'sell' : 'buy';
    const matchQuery = { symbol: upperSymbol, type: oppositeType, status: 'open' };
    
    if (type === 'buy') matchQuery.price = { $lte: price };
    if (type === 'sell') matchQuery.price = { $gte: price };

    const sortOrder = type === 'buy' ? { price: 1 } : { price: -1 };
    const openOrders = await Order.find(matchQuery).sort(sortOrder);

    let remainingAmount = amount;

    for (let matchOrder of openOrders) {
      if (remainingAmount <= 0) break;

      const tradeAmount = Math.min(remainingAmount, matchOrder.amount - matchOrder.filled);
      const tradePrice = matchOrder.price; 

      remainingAmount -= tradeAmount;
      newOrder.filled += tradeAmount;
      matchOrder.filled += tradeAmount;

      if (newOrder.filled === newOrder.amount) newOrder.status = 'fulfilled';
      if (matchOrder.filled === matchOrder.amount) matchOrder.status = 'fulfilled';
      await matchOrder.save();

      const trade = new Trade({ symbol: upperSymbol, type, amount: tradeAmount, price: tradePrice, user: user.username });
      await trade.save();

      const matchUser = await User.findById(matchOrder.user);
      if (type === 'buy') {
        user.balance -= (tradeAmount * tradePrice);
        user.portfolio.set(upperSymbol, (user.portfolio.get(upperSymbol) || 0) + tradeAmount);
        matchUser.balance += (tradeAmount * tradePrice);
        matchUser.portfolio.set(upperSymbol, (matchUser.portfolio.get(upperSymbol) || 0) - tradeAmount);
      } else {
        user.balance += (tradeAmount * tradePrice);
        user.portfolio.set(upperSymbol, (user.portfolio.get(upperSymbol) || 0) - tradeAmount);
        matchUser.balance -= (tradeAmount * tradePrice);
        matchUser.portfolio.set(upperSymbol, (matchUser.portfolio.get(upperSymbol) || 0) + tradeAmount);
      }
      await matchUser.save();
    }

    await newOrder.save();
    await user.save();

    io.emit('market_update');

    res.status(201).json({ 
      message: "Order processed", 
      order: newOrder, 
      updatedBalance: user.balance,
      updatedPortfolio: Object.fromEntries(user.portfolio)
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to process order", details: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
