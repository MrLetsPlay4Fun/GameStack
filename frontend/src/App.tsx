import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ServerProvider } from './context/ServerContext';
import { authApi } from './api/auth';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import DashboardPage from './pages/DashboardPage';
import CreateServerPage from './pages/CreateServerPage';
import ServerDetailPage from './pages/ServerDetailPage';

// Schützt Seiten – leitet zur Login-Seite weiter wenn nicht eingeloggt
function PrivateRoute({ children }: { children: React.ReactElement }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="min-h-screen bg-[#1e1f24]" />;
  return user ? children : <Navigate to="/login" replace />;
}

// Haupt-Router-Logik mit Setup-Erkennung
function AppRoutes() {
  const { user, isLoading } = useAuth();
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);

  useEffect(() => {
    authApi.status()
      .then((res) => {
        setSetupRequired(res.data.setupRequired);
      })
      .catch(() => {
        // Backend nicht erreichbar – trotzdem Login anzeigen
        setSetupRequired(false);
      });
  }, []);

  // Warten bis Auth-Status und Setup-Status geladen
  if (isLoading || setupRequired === null) {
    return <div className="min-h-screen bg-[#1e1f24]" />;
  }

  // Erster Start: kein User vorhanden → Setup
  if (setupRequired) {
    return (
      <Routes>
        <Route path="*" element={<SetupPage onComplete={() => setSetupRequired(false)} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <DashboardPage />
          </PrivateRoute>
        }
      />
      <Route path="/servers/new" element={<PrivateRoute><CreateServerPage /></PrivateRoute>} />
      <Route path="/servers/:id" element={<PrivateRoute><ServerDetailPage /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ServerProvider>
          <AppRoutes />
        </ServerProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
