import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import NavBar from './components/NavBar';
import Login from './pages/Login';
import Enquiries from './pages/Enquiries';
import Quotations from './pages/Quotations';
import SalesOrders from './pages/SalesOrders';
import Dashboard from './pages/Dashboard';
import AdminWorkspace from './pages/AdminWorkspace';
import SalesWorkspace from './pages/SalesWorkspace';
import About from './pages/About';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NavBar />
        <main className="container">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
            />
            <Route
              path="/admin"
              element={<ProtectedRoute requiredRole="ADMIN"><AdminWorkspace /></ProtectedRoute>}
            />
            <Route
              path="/sales"
              element={<ProtectedRoute requiredRole="SALES"><SalesWorkspace /></ProtectedRoute>}
            />
            <Route
              path="/about"
              element={<ProtectedRoute><About /></ProtectedRoute>}
            />
            <Route
              path="/enquiries"
              element={
                <ProtectedRoute>
                  <Enquiries />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quotations"
              element={
                <ProtectedRoute>
                  <Quotations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales-orders"
              element={
                <ProtectedRoute>
                  <SalesOrders />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

