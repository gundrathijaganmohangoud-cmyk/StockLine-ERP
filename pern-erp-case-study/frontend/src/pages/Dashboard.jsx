import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';

const currency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState({ enquiries: [], quotations: [], orders: [], products: [] });
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      axiosClient.get('/enquiries'),
      axiosClient.get('/quotations'),
      axiosClient.get('/sales-orders'),
      axiosClient.get('/products'),
    ]).then(([enquiries, quotations, orders, products]) => {
      setData({ enquiries: enquiries.data, quotations: quotations.data, orders: orders.data, products: products.data });
    }).catch((err) => setError(err.message || 'Unable to load operating overview'));
  }, []);

  const openQuotes = data.quotations.filter((item) => item.status === 'DRAFT' || item.status === 'SENT').length;
  const pendingOrders = data.orders.filter((item) => item.status === 'PENDING').length;
  const lowStock = data.products.filter((item) => item.availableQty < 100).length;
  const pipeline = data.quotations.filter((item) => item.status === 'ACCEPTED').reduce((sum, item) => sum + Number(item.grandTotal || 0), 0);

  return (
    <div className="dashboard-page">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">{user && user.role === 'ADMIN' ? 'Control room' : 'Revenue workspace'}</p>
          <h1>Good to see you, {user ? user.email.split('@')[0] : 'there'}.</h1>
          <p className="hero-copy">See the health of your order flow, then jump straight into the next decision.</p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to={user && user.role === 'ADMIN' ? '/admin' : '/sales'}>Open my workspace</Link>
            <Link className="text-link" to="/about">How StockFlow works <span>→</span></Link>
          </div>
        </div>
        <div className="flow-visual" aria-hidden="true">
          <div className="flow-plane"><span>DEMAND</span><span>VALUE</span><span>FULFIL</span></div>
          <div className="flow-bars"><i /><i /><i /><i /><i /></div>
          <div className="flow-caption">LIVE ORDER FLOW</div>
        </div>
      </section>

      {error && <div className="banner error">{error}</div>}
      <div className="metric-grid">
        <article className="metric-card"><span className="metric-label">Active enquiries</span><strong>{data.enquiries.filter((item) => item.status !== 'LOST').length}</strong><small>Demand still in motion</small></article>
        <article className="metric-card accent"><span className="metric-label">Quote pipeline</span><strong>{currency(pipeline)}</strong><small>{openQuotes} quotes need attention</small></article>
        <article className="metric-card"><span className="metric-label">Orders to confirm</span><strong>{pendingOrders}</strong><small>Inventory reservation queue</small></article>
        <article className="metric-card warning"><span className="metric-label">Low availability</span><strong>{lowStock}</strong><small>Products below 100 units</small></article>
      </div>

      <div className="dashboard-columns">
        <section className="surface-panel">
          <div className="section-heading"><div><p className="eyebrow">Workflow</p><h2>What needs a decision</h2></div><Link className="text-link" to="/quotations">View all <span>→</span></Link></div>
          <div className="decision-list">
            {data.quotations.filter((item) => item.status === 'DRAFT' || item.status === 'SENT').slice(0, 4).map((item) => (
              <div className="decision-row" key={item.id}><span className="decision-dot" /><div><strong>{item.quotationNumber}</strong><small>{item.customerName || 'Customer'} · {item.status === 'DRAFT' ? 'Ready to send' : 'Awaiting response'}</small></div><StatusBadge status={item.status} /></div>
            ))}
            {!openQuotes && <p className="empty-state">No open quotations. Your commercial queue is clear.</p>}
          </div>
        </section>
        <section className="surface-panel inventory-panel">
          <div className="section-heading"><div><p className="eyebrow">Inventory signal</p><h2>Availability watch</h2></div><Link className="text-link" to="/sales-orders">Orders <span>→</span></Link></div>
          {data.products.slice(0, 5).map((product) => <div className="stock-row" key={product.id}><div><strong>{product.productCode}</strong><small>{product.productName}</small></div><div className="stock-track"><span style={{ width: `${Math.min(100, Math.max(4, product.availableQty / 10))}%` }} /></div><b>{product.availableQty}</b></div>)}
        </section>
      </div>
    </div>
  );
}
