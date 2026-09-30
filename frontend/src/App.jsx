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
      <div className="auth-page">
        <div className="auth-brand">
          <div className="auth-brand-content">
            <div className="auth-logo">
              <span className="logo-icon">&#9639;</span>
              <span className="logo-text">TradeFloor</span>
            </div>
            <p className="auth-tagline">Real-time virtual stock trading simulator</p>
            <div className="auth-stats">
              <div className="auth-stat">
                <span className="auth-stat-num">5</span>
                <span className="auth-stat-label">Markets</span>
              </div>
              <div className="auth-stat">
                <span className="auth-stat-num">24/7</span>
                <span className="auth-stat-label">Trading</span>
              </div>
              <div className="auth-stat">
                <span className="auth-stat-num">$10K</span>
                <span className="auth-stat-label">Start Capital</span>
              </div>
            </div>
          </div>
          <div className="auth-ticker">
            {prices.slice(0, 3).map(p => (
              <div key={p.symbol} className={'auth-ticker-item ' + (p.change >= 0 ? 'up' : 'down')}>
                <span className="auth-ticker-sym">{p.symbol}</span>
                <span className="auth-ticker-prc">${p.price?.toFixed(2)}</span>
                <span className="auth-ticker-chg">{p.changePercent?.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-header">
            <h2>{isLoginMode ? 'Welcome Back' : 'Create Account'}</h2>
            <p>{isLoginMode ? 'Sign in to your TradeFloor account' : 'Start your virtual trading journey'}</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="auth-form">
            <div className={'auth-toggle' + (isLoginMode ? ' login' : ' register')}>
              <span className={'auth-toggle-btn' + (isLoginMode ? ' active' : '')} onClick={() => setIsLoginMode(true)}>Login</span>
              <span className={'auth-toggle-btn' + (!isLoginMode ? ' active' : '')} onClick={() => setIsLoginMode(false)}>Register</span>
            </div>

            {!isLoginMode && (
              <div className="input-group">
                <label>Username</label>
                <div className="input-wrapper">
                  <span className="input-icon">&#9997;</span>
                  <input type="text" name="username" placeholder="Choose a username" value={authForm.username} onChange={handleAuthChange} required />
                </div>
              </div>
            )}

            <div className="input-group">
              <label>Email</label>
              <div className="input-wrapper">
                <span className="input-icon">&#9993;</span>
                <input type="email" name="email" placeholder="you@example.com" value={authForm.email} onChange={handleAuthChange} required />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="input-wrapper">
                <span className="input-icon">&#128274;</span>
                <input type="password" name="password" placeholder={isLoginMode ? 'Enter your password' : 'Create a strong password'} value={authForm.password} onChange={handleAuthChange} required />
              </div>
            </div>

            <button type="submit" className="auth-submit">
              {isLoginMode ? 'Sign In' : 'Create Account'}
            </button>

            {authMessage && <p className={'auth-message ' + (authMessage.includes('successful') || authMessage.includes('successfully') ? 'success' : 'error')}>{authMessage}</p>}
          </form>
        </div>
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

        <div className="col-left">

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


        <div className="col-center">

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


        <div className="col-right">

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
