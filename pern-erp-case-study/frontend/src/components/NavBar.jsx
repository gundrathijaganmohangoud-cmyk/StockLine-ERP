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
      <span className="brand">IndustraFlow</span>
      {isAuthenticated && (
        <>
          <nav className="nav-links">
            <NavLink to="/enquiries">Enquiries</NavLink>
            <NavLink to="/quotations">Quotations</NavLink>
            <NavLink to="/sales-orders">Sales Orders</NavLink>
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
