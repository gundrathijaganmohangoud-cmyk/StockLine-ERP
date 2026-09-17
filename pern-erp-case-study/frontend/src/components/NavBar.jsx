import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <header className="topbar">
      <button type="button" className="brand brand-button" onClick={() => navigate('/dashboard')}>
        <span className="brand-mark">SF</span>
        <span><strong>StockFlow</strong><small>ERP OPERATIONS</small></span>
      </button>
      {isAuthenticated && (
        <>
          <nav className="nav-links">
            <NavLink to="/dashboard">Overview</NavLink>
            {user && user.role === 'ADMIN' && <NavLink to="/admin">Admin desk</NavLink>}
            {user && user.role === 'SALES' && <NavLink to="/sales">Sales desk</NavLink>}
            <NavLink to="/enquiries">Enquiries</NavLink>
            <NavLink to="/quotations">Quotations</NavLink>
            <NavLink to="/sales-orders">Sales Orders</NavLink>
            <NavLink to="/about">About</NavLink>
          </nav>
          <div className="topbar-right">
            <span className="user-email">{user ? user.email : ''}</span>
            <span className={'badge role-' + (user ? String(user.role).toLowerCase() : '')}>
              {user ? user.role : ''}
            </span>
            <button type="button" className="btn btn-small" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </>
      )}
    </header>
  );
}
