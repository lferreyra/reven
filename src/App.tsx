import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Header } from '@/src/components/layout/Header';
import { Home } from '@/src/pages/Home';
import { Marketplace } from '@/src/pages/Marketplace';
import { VehicleDetail } from '@/src/pages/VehicleDetail';
import { Publish } from '@/src/pages/Publish';
import { Login } from '@/src/pages/Login';
import { Messages } from '@/src/pages/Messages';
import { Profile } from '@/src/pages/Profile';
import { Admin } from '@/src/pages/Admin';
import { ProtectedRoute } from '@/src/components/auth/ProtectedRoute';
import { useEffect } from 'react';

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';
  const isHomePage = location.pathname === '/';
  const isAdminPage = location.pathname === '/admin';

  useEffect(() => {
    console.log("🚀 REVEN SYSTEM v1.2.0 - API & ACARA Active");
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans antialiased">
      {!isLoginPage && !isAdminPage && <Header />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
          <Route path="/marketplace" element={
            <ProtectedRoute>
              <Marketplace />
            </ProtectedRoute>
          } />
          <Route path="/vehicle/:slug" element={
            <ProtectedRoute>
              <VehicleDetail />
            </ProtectedRoute>
          } />
          <Route path="/publish" element={
            <ProtectedRoute>
              <Publish />
            </ProtectedRoute>
          } />
          <Route path="/messages" element={
            <ProtectedRoute>
              <Messages />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/profile/:uid" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={<Admin />} />
          
          {/* Fallback to home */}
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      {!isLoginPage && !isHomePage && !isAdminPage && (
        <footer className="border-t py-6 md:py-0 bg-background">
          <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row px-4 md:px-8">
            <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
              &copy; {new Date().getFullYear()} REVEN. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
              <a href="#" className="hover:underline underline-offset-4">Términos</a>
              <a href="#" className="hover:underline underline-offset-4">Privacidad</a>
              <a href="#" className="hover:underline underline-offset-4">Soporte</a>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
