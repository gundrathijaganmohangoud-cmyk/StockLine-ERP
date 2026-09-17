import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function SalesWorkspace() {
  const { user } = useAuth();
  return <div className="workspace-page sales-workspace">
    <section className="workspace-intro"><div><p className="eyebrow">Sales desk · {user ? user.email : ''}</p><h1>Turn intent into revenue.</h1><p>Capture the customer need, shape a defensible quote, and move accepted work into fulfillment.</p></div><div className="workspace-stamp"><span>SALES</span><strong>02</strong><small>REVENUE LAYER</small></div></section>
    <div className="action-grid">
      <Link className="action-card" to="/enquiries"><span className="action-index">01</span><strong>Capture demand</strong><small>Create an enquiry with customer and product context.</small><span className="card-arrow">→</span></Link>
      <Link className="action-card" to="/quotations"><span className="action-index">02</span><strong>Build a quote</strong><small>Use server-authoritative pricing with discount and GST.</small><span className="card-arrow">→</span></Link>
      <Link className="action-card" to="/sales-orders"><span className="action-index">03</span><strong>Follow delivery</strong><small>Track accepted quotations and order progress.</small><span className="card-arrow">→</span></Link>
    </div>
    <section className="explain-band"><p className="eyebrow">Why this desk exists</p><h2>Good sales work creates clarity for everyone downstream.</h2><p>StockFlow keeps the commercial record clean from first enquiry to accepted quotation. You can create and progress demand, while inventory control remains with the Admin role.</p></section>
  </div>;
}
