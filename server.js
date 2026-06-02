const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

const authRoutes = require('./routes/auth');
const { router: orderRoutes, setSocketIO } = require('./routes/orders');
const assetRoutes = require('./routes/assets');
const portfolioRoutes = require('./routes/portfolio');

setSocketIO(io);

app.use('/api/users', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/portfolio', portfolioRoutes);

app.get('/api/trades', async (req, res) => {
  try {
    const Trade = require('./models/Trade');
    const trades = await Trade.find().sort({ createdAt: -1 }).limit(50);
    res.json(trades);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

const { seedAssets, startPriceSimulation } = require('./services/priceSimulator');

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('disconnect', () => console.log('User disconnected:', socket.id));
});

Promise.all([seedAssets()]).then(() => {
  startPriceSimulation(io, 2000);
  console.log('Price simulation started');
});

server.listen(PORT, () => {
  console.log('TradeFloor server running on http://localhost:' + PORT);
});
