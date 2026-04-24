import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PatientDetail from './pages/PatientDetail';
import AdminUsers from './pages/AdminUsers';
import AdminSettings from './pages/AdminSettings';
import AuditLogs from './pages/AuditLogs';
import ProfileSettings from './pages/ProfileSettings';
import AppShell from './components/AppShell';
import { AuthAPI } from './services/api';
import { connectSocket, disconnectSocket } from './services/socket';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function FullPageLoader({ label }) {
  return (
    <div className="page-state">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}

function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadSession() {
    try {
      const res = await AuthAPI.me();
      setUser(res.data.user);
      connectSocket();
    } catch (error) {
      try {
        await AuthAPI.refresh();
        const res = await AuthAPI.me();
        setUser(res.data.user);
        connectSocket();
      } catch (refreshError) {
        setUser(null);
        disconnectSocket();
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSession();
  }, []);

  async function login(username, password) {
    const res = await AuthAPI.login(username, password);
    setUser(res.data.user);
    connectSocket();
    navigate('/dashboard', { replace: true });
    return res.data.user;
  }

  async function logout() {
    try {
      await AuthAPI.logout();
    } finally {
      setUser(null);
      disconnectSocket();
      navigate('/login', { replace: true });
    }
  }

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    reloadSession: loadSession,
    setUser
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageLoader label="Restoring secure session..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppRoutes() {
  const location = useLocation();
  const isAuthScreen = location.pathname === '/login';

  return (
    <div className={`app ${isAuthScreen ? 'auth-layout' : 'shell-layout'}`}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/dashboard"
          element={(
            <ProtectedRoute>
              <AppShell>
                <Dashboard />
              </AppShell>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/patients/:patientId"
          element={(
            <ProtectedRoute>
              <AppShell>
                <PatientDetail />
              </AppShell>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin/users"
          element={(
            <ProtectedRoute roles={['admin']}>
              <AppShell>
                <AdminUsers />
              </AppShell>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin/settings"
          element={(
            <ProtectedRoute roles={['admin']}>
              <AppShell>
                <AdminSettings />
              </AppShell>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/admin/audit"
          element={(
            <ProtectedRoute roles={['admin']}>
              <AppShell>
                <AuditLogs />
              </AppShell>
            </ProtectedRoute>
          )}
        />
        <Route
          path="/settings/profile"
          element={(
            <ProtectedRoute>
              <AppShell>
                <ProfileSettings />
              </AppShell>
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
