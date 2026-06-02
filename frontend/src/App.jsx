import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [authMessage, setAuthMessage] = useState('');

  const [trades, setTrades] = useState([]);
  const [tradeForm, setTradeForm] = useState({ symbol: '', type: 'buy', amount: '', price: '' });
  const [tradeMessage, setTradeMessage] = useState('');

  const API_URL = 'http://localhost:5001/api';

  const handleAuthChange = (e) => setAuthForm({ ...authForm, [e.target.name]: e.target.value });

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isLoginMode ? '/users/login' : '/users/register';
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
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
          setAuthMessage('✅ Registered successfully! Please login.');
          setIsLoginMode(true);
        }
      } else {
        setAuthMessage(`❌ ${data.error || 'Authentication failed'}`);
      }
    } catch (error) {
      console.error("Auth error:", error);
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const fetchTrades = async () => {
    try {
      const response = await fetch(`${API_URL}/trades`);
      if(response.ok) {
        const data = await response.json();
        setTrades(data);
      }
    } catch (error) {
      console.error("Error fetching trades:", error);
    }
  };

  useEffect(() => {
    if (token) fetchTrades();
  }, [token]);

  const handleTradeChange = (e) => setTradeForm({ ...tradeForm, [e.target.name]: e.target.value });

  const handleTradeSubmit = async (e) => {
    e.preventDefault();
    try {
      // هنا أصلحنا الرابط ليرسل إلى orders بدلاً من trades
      const response = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...tradeForm,
          amount: Number(tradeForm.amount),
          price: Number(tradeForm.price),
          userId: user.id // أرسلنا المعرّف الفرعي للمستخدم
        })
      });

      const data = await response.json();

      if (response.ok) {
        setTradeMessage('✅ Order submitted successfully!');
        setTradeForm({ symbol: '', type: 'buy', amount: '', price: '' });
        fetchTrades();
        
        // تحديث الرصيد والمحفظة على الشاشة فوراً
        if (data.updatedBalance !== undefined) {
          const updatedUser = { ...user, balance: data.updatedBalance, portfolio: data.updatedPortfolio || user.portfolio };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
        
        setTimeout(() => setTradeMessage(''), 3000);
      } else {
        // عرض الخطأ القادم من السيرفر (مثل رصيد غير كافي أو أصول غير كافية)
        setTradeMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      console.error("Trade error:", error);
      setTradeMessage('❌ Error connecting to server');
    }
  };

  if (!token) {
    return (
      <div className="container">
        <header>
          <h1>TradeFloor 📈</h1>
          <p>Please {isLoginMode ? 'Login' : 'Register'} to access the platform</p>
        </header>
        <section className="card" style={{ maxWidth: '400px', margin: '0 auto' }}>
          <h2>{isLoginMode ? 'Login' : 'Register'}</h2>
          <form onSubmit={handleAuthSubmit}>
            {!isLoginMode && (
              <input type="text" name="username" placeholder="Username" value={authForm.username} onChange={handleAuthChange} required />
            )}
            <input type="email" name="email" placeholder="Email" value={authForm.email} onChange={handleAuthChange} required />
            <input type="password" name="password" placeholder="Password" value={authForm.password} onChange={handleAuthChange} required />
            <button type="submit">{isLoginMode ? 'Login' : 'Register'}</button>
          </form>
          {authMessage && <p className="message" style={{color: '#f44336'}}>{authMessage}</p>}
          <p style={{ marginTop: '15px', textAlign: 'center', cursor: 'pointer', color: '#4CAF50' }} onClick={() => setIsLoginMode(!isLoginMode)}>
            {isLoginMode ? "Don't have an account? Register here." : "Already have an account? Login here."}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>TradeFloor 📈</h1>
          <p>Welcome back, <strong>{user?.username}</strong></p>
        </div>
        <button onClick={handleLogout} style={{ backgroundColor: '#f44336' }}>Logout</button>
      </header>

      <main>
        <section className="card" style={{ borderLeft: '5px solid #4CAF50' }}>
          <h2>💰 My Portfolio</h2>
          <div style={{ fontSize: '1.5rem', margin: '10px 0' }}>
            Available Balance: <strong style={{ color: '#4CAF50' }}>${user?.balance?.toLocaleString()}</strong>
          </div>
          <div style={{ marginTop: '10px', color: '#aaa' }}>
            <strong>Your Assets:</strong>
            {user?.portfolio && Object.keys(user.portfolio).length > 0 ? (
              <ul style={{ paddingLeft: '20px', marginTop: '5px' }}>
                {Object.entries(user.portfolio).map(([sym, qty]) => (
                  <li key={sym} style={{color: '#fff'}}>{sym.toUpperCase()}: {qty} units</li>
                ))}
              </ul>
            ) : (
              <p style={{fontStyle: 'italic'}}>No assets held yet</p>
            )}
          </div>
        </section>

        <section className="card">
          <h2>Execute New Trade</h2>
          <form onSubmit={handleTradeSubmit}>
            <div className="input-group">
              <input type="text" name="symbol" value={tradeForm.symbol} onChange={handleTradeChange} placeholder="Symbol (e.g. BTC)" required />
              <select name="type" value={tradeForm.type} onChange={handleTradeChange} required>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </div>
            <div className="input-group">
              <input type="number" name="amount" value={tradeForm.amount} onChange={handleTradeChange} placeholder="Amount" step="0.01" required />
              <input type="number" name="price" value={tradeForm.price} onChange={handleTradeChange} placeholder="Price ($)" step="0.01" required />
            </div>
            <button type="submit">Submit Trade</button>
          </form>
          {tradeMessage && <p className="message">{tradeMessage}</p>}
        </section>

        <section className="card">
          <h2>Market Trades</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade, index) => (
                  <tr key={index}>
                    <td>{trade.user}</td>
                    <td><strong>{trade.symbol}</strong></td>
                    <td className={trade.type === 'buy' ? 'buy' : 'sell'}>{trade.type.toUpperCase()}</td>
                    <td>{trade.amount}</td>
                    <td>${trade.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
