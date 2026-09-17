import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Guards a route: requires a session, and optionally a specific role.
// Usage: <ProtectedRoute requiredRole='ADMIN'><AdminPage /></ProtectedRoute>
export default function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredRole) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!user || allowed.indexOf(user.role) === -1) {
      // Authenticated but not authorized: send to the default screen.
      return <Navigate to="/enquiries" replace />;
    }
  }

  return children;
}
