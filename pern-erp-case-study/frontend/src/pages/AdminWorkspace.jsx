import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminWorkspace() {
  const { user } = useAuth();
  return <div className="workspace-page admin-workspace">
    <section className="workspace-intro"><div><p className="eyebrow">Admin desk · {user ? user.email : ''}</p><h1>Protect the promise.</h1><p>Reserve scarce stock, release confirmed orders, and keep the physical operation aligned with the commercial one.</p></div><div className="workspace-stamp"><span>ADMIN</span><strong>01</strong><small>CONTROL LAYER</small></div></section>
    <div className="action-grid">
      <Link className="action-card" to="/sales-orders"><span className="action-index">01</span><strong>Confirm orders</strong><small>Reserve inventory atomically for accepted demand.</small><span className="card-arrow">→</span></Link>
      <Link className="action-card" to="/sales-orders"><span className="action-index">02</span><strong>Dispatch goods</strong><small>Record vehicle, driver, quantities and stock deduction.</small><span className="card-arrow">→</span></Link>
      <Link className="action-card" to="/about"><span className="action-index">03</span><strong>Read the control model</strong><small>Understand why every state change is protected.</small><span className="card-arrow">→</span></Link>
    </div>
    <section className="explain-band"><p className="eyebrow">Why this desk exists</p><h2>Commercial confidence only matters when the warehouse can fulfill it.</h2><p>StockFlow gives administrators the final operational controls. Confirmation reserves stock; dispatch decreases both physical and reserved quantities so availability remains truthful.</p></section>
  </div>;
}
