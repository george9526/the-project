import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './App.css';

const SOCKET_URL = 'http://localhost:5001';
const API_URL = 'http://localhost:5001/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [authMessage, setAuthMessage] = useState('');

  const [prices, setPrices] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState('TECH');
  const [orderBook, setOrderBook] = useState({ buys: [], sells: [] });
  const [trades, setTrades] = useState([]);
  const [activeOrders, setActiveOrders] = useState([]);
  const [portfolio, setPortfolio] = useState(null);
  const [userTrades, setUserTrades] = useState([]);
  const [tradeForm, setTradeForm] = useState({ symbol: 'TECH', type: 'buy', orderType: 'limit', amount: '', price: '' });
  const [tradeMessage, setTradeMessage] = useState('');

  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('prices', (data) => setPrices(data));
    socket.on('orderbook', (data) => {
      if (data.symbol === selectedAsset) setOrderBook({ buys: data.buys, sells: data.sells });
    });
    socket.on('new_trade', (trade) => {
      setTrades(prev => [trade, ...prev].slice(0, 50));
    });
    socket.on('portfolio_update', (data) => {
      if (user && String(data.userId) === String(user.id)) {
        const updated = { ...user, balance: data.balance, portfolio: data.portfolio };
        setUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
      }
    });
    socket.on('market_update', () => {
      fetchTrades();
      fetchActiveOrders();
      fetchPortfolio();
    });

    return () => { socket.disconnect(); };
  }, [token, user?.id]);

  useEffect(() => {
    if (token) {
      fetchTrades();
      fetchActiveOrders();
      fetchPortfolio();
      fetchUserTrades();
    }
  }, [token]);

  useEffect(() => {
    if (socketRef.current && token) {
      fetchOrderBook(selectedAsset);
    }
  }, [selectedAsset, token]);

  const handleAuthChange = (e) => setAuthForm({ ...authForm, [e.target.name]: e.target.value });

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isLoginMode ? '/users/login' : '/users/register';
    try {
      const response = await fetch(API_URL + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await response.json();
      if (response.ok) {
        if (isLoginMode) {
          setToken(data.token);
          setUser(data.user);
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          setAuthMessage('');
        } else {
          setAuthMessage('Registered successfully! Please login.');
          setIsLoginMode(true);
        }
      } else {
        setAuthMessage(data.error || 'Authentication failed');
      }
    } catch (error) {
      console.error('Auth error:', error);
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (socketRef.current) socketRef.current.disconnect();
  };

  const fetchTrades = async () => {
    try {
      const response = await fetch(API_URL + '/trades');
      if (response.ok) setTrades((await response.json()));
    } catch (error) { console.error('Error fetching trades:', error); }
  };

  const fetchOrderBook = async (symbol) => {
    try {
      const response = await fetch(API_URL + '/assets/' + symbol + '/orderbook');
      if (response.ok) {
        const data = await response.json();
        setOrderBook({ buys: data.buys, sells: data.sells });
      }
    } catch (error) { console.error('Error fetching order book:', error); }
  };

  const fetchActiveOrders = async () => {
    if (!token) return;
    try {
      const response = await fetch(API_URL + '/orders/active', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (response.ok) setActiveOrders((await response.json()));
    } catch (error) { console.error('Error fetching orders:', error); }
  };

  const fetchPortfolio = async () => {
    if (!token) return;
    try {
      const response = await fetch(API_URL + '/portfolio', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (response.ok) setPortfolio((await response.json()));
    } catch (error) { console.error('Error fetching portfolio:', error); }
  };

  const fetchUserTrades = async () => {
    if (!token) return;
    try {
      const response = await fetch(API_URL + '/portfolio/trades', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (response.ok) setUserTrades((await response.json()));
    } catch (error) { console.error('Error fetching user trades:', error); }
  };

  const cancelOrder = async (orderId) => {
    try {
      const response = await fetch(API_URL + '/orders/' + orderId, {
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (response.ok) {
        fetchActiveOrders();
        fetchPortfolio();
      }
    } catch (error) { console.error('Error canceling order:', error); }
  };

  const handleTradeChange = (e) => setTradeForm({ ...tradeForm, [e.target.name]: e.target.value });

  const handleTradeSubmit = async (e) => {
    e.preventDefault();
    setTradeMessage('');
    try {
      const response = await fetch(API_URL + '/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          symbol: tradeForm.symbol,
          type: tradeForm.type,
          orderType: tradeForm.orderType,
          amount: Number(tradeForm.amount),
          price: Number(tradeForm.price),
          userId: user.id
        })
      });
      const data = await response.json();
      if (response.ok) {
        setTradeMessage('Order submitted successfully!');
        setTradeForm({ ...tradeForm, amount: '', price: '' });
        fetchActiveOrders();
        fetchPortfolio();
        setTimeout(() => setTradeMessage(''), 3000);
      } else {
        setTradeMessage(data.error);
      }
    } catch (error) {
      console.error('Trade error:', error);
      setTradeMessage('Error connecting to server');
    }
  };

  const selectedPrice = prices.find(p => p.symbol === selectedAsset);

  if (!token) {
    return (
      <div className="container">
        <header><h1>TradeFloor</h1><p>Please {isLoginMode ? 'Login' : 'Register'} to access the platform</p></header>
        <section className="card" style={{ maxWidth: '400px', margin: '0 auto' }}>
          <h2>{isLoginMode ? 'Login' : 'Register'}</h2>
          <form onSubmit={handleAuthSubmit}>
            {!isLoginMode && <input type="text" name="username" placeholder="Username" value={authForm.username} onChange={handleAuthChange} required />}
            <input type="email" name="email" placeholder="Email" value={authForm.email} onChange={handleAuthChange} required />
            <input type="password" name="password" placeholder="Password" value={authForm.password} onChange={handleAuthChange} required />
            <button type="submit">{isLoginMode ? 'Login' : 'Register'}</button>
          </form>
          {authMessage && <p className="message-error">{authMessage}</p>}
          <p className="toggle-link" onClick={() => setIsLoginMode(!isLoginMode)}>
            {isLoginMode ? "Don't have an account? Register here." : 'Already have an account? Login here.'}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="container">
      <header>
        <div className="header-top">
          <h1>TradeFloor</h1>
          <div className="header-user">
            <span>Welcome, <strong>{user?.username}</strong></span>
            <button className="btn-logout" onClick={handleLogout}>Logout</button>
          </div>
        </div>
        {/* Price Ticker */}
        <div className="ticker">
          {prices.map(p => (
            <div key={p.symbol} className={'ticker-item' + (p.change >= 0 ? ' up' : ' down')} onClick={() => setSelectedAsset(p.symbol)}>
              <span className="ticker-symbol">{p.symbol}</span>
              <span className="ticker-price">${p.price?.toFixed(2)}</span>
              <span className="ticker-change">{p.change >= 0 ? '+' : ''}{p.changePercent?.toFixed(2)}%</span>
            </div>
          ))}
        </div>
      </header>

      <main className="dashboard">
        {/* Left Column */}
        <div className="col-left">
          {/* Portfolio */}
          <section className="card">
            <h2>Portfolio</h2>
            <div className="portfolio-summary">
              <div className="stat">
                <span className="stat-label">Balance</span>
                <span className="stat-value">${user?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Total Value</span>
                <span className="stat-value">${portfolio?.totalValue?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}</span>
              </div>
            </div>
            <div className="holdings">
              <h3>Holdings</h3>
              {portfolio?.holdings?.length > 0 ? (
                portfolio.holdings.map(h => (
                  <div key={h.symbol} className="holding-row">
                    <span className="holding-symbol">{h.symbol}</span>
                    <span className="holding-qty">{h.quantity} shares</span>
                    <span className="holding-value">${h.value?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                ))
              ) : <p className="empty">No holdings yet</p>}
            </div>
          </section>

          {/* Order Book */}
          <section className="card">
            <h2>Order Book - {selectedAsset}</h2>
            <div className="order-book">
              <div className="ob-column">
                <h4 className="ob-header sell-header">Sells</h4>
                {orderBook.sells?.slice(0, 8).map(o => (
                  <div key={o._id} className="ob-row sell-row">
                    <span>{o.amount - o.filled}</span>
                    <span>${o.price?.toFixed(2)}</span>
                  </div>
                ))}
                {(!orderBook.sells || orderBook.sells.length === 0) && <p className="empty">No sell orders</p>}
              </div>
              <div className="ob-spread">
                {selectedPrice && <span className="spread-price">${selectedPrice.price?.toFixed(2)}</span>}
              </div>
              <div className="ob-column">
                <h4 className="ob-header buy-header">Buys</h4>
                {orderBook.buys?.slice(0, 8).map(o => (
                  <div key={o._id} className="ob-row buy-row">
                    <span>{o.amount - o.filled}</span>
                    <span>${o.price?.toFixed(2)}</span>
                  </div>
                ))}
                {(!orderBook.buys || orderBook.buys.length === 0) && <p className="empty">No buy orders</p>}
              </div>
            </div>
          </section>
        </div>

        {/* Center Column */}
        <div className="col-center">
          {/* Trade Form */}
          <section className="card">
            <h2>Place Order</h2>
            <form onSubmit={handleTradeSubmit}>
              <div className="form-row">
                <select name="symbol" value={tradeForm.symbol} onChange={handleTradeChange}>
                  {prices.map(p => <option key={p.symbol} value={p.symbol}>{p.symbol}</option>)}
                </select>
                <select name="type" value={tradeForm.type} onChange={handleTradeChange}>
                  <option value="buy">Buy</option>
                  <option value="sell">Sell</option>
                </select>
                <select name="orderType" value={tradeForm.orderType} onChange={handleTradeChange}>
                  <option value="limit">Limit</option>
                  <option value="market">Market</option>
                </select>
              </div>
              <div className="form-row">
                <input type="number" name="amount" value={tradeForm.amount} onChange={handleTradeChange} placeholder="Amount" step="1" min="1" required />
                {tradeForm.orderType === 'limit' && (
                  <input type="number" name="price" value={tradeForm.price} onChange={handleTradeChange} placeholder="Price ($)" step="0.01" min="0.01" required />
                )}
              </div>
              <button type="submit" className={'btn-trade ' + (tradeForm.type === 'buy' ? 'btn-buy' : 'btn-sell')}>
                {tradeForm.type === 'buy' ? 'Buy' : 'Sell'} {tradeForm.symbol}
              </button>
            </form>
            {tradeMessage && <p className={'message ' + (tradeMessage.includes('successful') ? 'message-success' : 'message-error')}>{tradeMessage}</p>}
          </section>

          {/* Active Orders */}
          <section className="card">
            <h2>Active Orders</h2>
            <div className="table-container">
              <table>
                <thead><tr><th>Symbol</th><th>Type</th><th>Amount</th><th>Price</th><th>Filled</th><th>Action</th></tr></thead>
                <tbody>
                  {activeOrders.map(o => (
                    <tr key={o._id}>
                      <td><strong>{o.symbol}</strong></td>
                      <td className={o.type === 'buy' ? 'buy' : 'sell'}>{o.type.toUpperCase()}</td>
                      <td>{o.amount}</td>
                      <td>${o.price?.toFixed(2)}</td>
                      <td>{o.filled}/{o.amount}</td>
                      <td><button className="btn-cancel" onClick={() => cancelOrder(o._id)}>Cancel</button></td>
                    </tr>
                  ))}
                  {activeOrders.length === 0 && <tr><td colSpan="6" className="empty">No active orders</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="col-right">
          {/* Market Trades */}
          <section className="card">
            <h2>Market Trades</h2>
            <div className="trade-feed">
              {trades.map((t, i) => (
                <div key={i} className="trade-item">
                  <span className={'trade-type ' + t.type}>{t.type.toUpperCase()}</span>
                  <span className="trade-symbol">{t.symbol}</span>
                  <span className="trade-amount">{t.amount} @ ${t.price?.toFixed(2)}</span>
                  <span className="trade-user">{t.user}</span>
                </div>
              ))}
              {trades.length === 0 && <p className="empty">No trades yet</p>}
            </div>
          </section>

          {/* My Trade History */}
          <section className="card">
            <h2>My History</h2>
            <div className="trade-feed">
              {userTrades.map((t, i) => (
                <div key={i} className="trade-item">
                  <span className={'trade-type ' + t.type}>{t.type.toUpperCase()}</span>
                  <span className="trade-symbol">{t.symbol}</span>
                  <span className="trade-amount">{t.amount} @ ${t.price?.toFixed(2)}</span>
                  <span className="trade-time">{new Date(t.createdAt).toLocaleTimeString()}</span>
                </div>
              ))}
              {userTrades.length === 0 && <p className="empty">No trade history</p>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
