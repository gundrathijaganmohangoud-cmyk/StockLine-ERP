import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@industraflow.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/enquiries');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (isAuthenticated) {
    return (
      <section className="card">
        <p>
          You are already logged in. <a href="/enquiries">Go to Enquiries</a>.
        </p>
      </section>
    );
  }

  return (
    <section className="card login-card">
      <div className="login-brand"><span className="brand-mark large">SF</span><span><strong>StockFlow</strong><small>ERP OPERATIONS</small></span></div>
      <p className="eyebrow">Industrial operations platform</p>
      <h1>Move every order forward.</h1>
      <p className="muted">One workspace for demand, pricing, inventory and dispatch.</p>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            required
          />
        </label>
        {error && <div className="banner error">{error}</div>}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
      <p className="muted small">
        Seeded accounts: admin@industraflow.com / sales@industraflow.com - password Password123!
      </p>
    </section>
  );
}

