import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { wagmiConfig } from '@/lib/wagmi';
import Navbar from '@/components/Navbar';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import AuthCallbackPage from '@/pages/AuthCallbackPage';
import SkillListPage from '@/pages/SkillListPage';
import SkillDetailPage from '@/pages/SkillDetailPage';
import UploadPage from '@/pages/UploadPage';
import LaunchpadPage from '@/pages/LaunchpadPage';
import CreateTokenPage from '@/pages/CreateTokenPage';
import LaunchpadDetailRouter from '@/pages/LaunchpadDetailRouter';
import AdminPage from '@/pages/AdminPage';
import DocsPage from '@/pages/DocsPage';
import PrivacyPage from '@/pages/PrivacyPage';
import TermsPage from '@/pages/TermsPage';
import DashboardPage from '@/pages/DashboardPage';
import RequestDetailPage from '@/pages/RequestDetailPage';
import GitHubBindCallbackPage from '@/pages/GitHubBindCallbackPage';
import { useAuthStore } from '@/store/auth.store';
import { ToastProvider } from '@/components/Toast';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { token, fetchUser, user } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      fetchUser();
    }
  }, [token, user, fetchUser]);

  return (
    <Routes>
      {/* Landing page - no navbar */}
      <Route path="/" element={<><Navbar /><div className="pt-16"><LandingPage /></div></>} />

      {/* Login - no navbar */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/auth/github-bind-callback" element={<GitHubBindCallbackPage />} />

      {/* Pages with navbar */}
      <Route path="/marketplace" element={<><Navbar /><div className="pt-16"><SkillListPage /></div></>} />
      <Route path="/skills/:id" element={<><Navbar /><div className="pt-16"><SkillDetailPage /></div></>} />
      <Route path="/launchpad" element={<><Navbar /><div className="pt-16"><LaunchpadPage /></div></>} />
      <Route path="/launchpad/:id" element={<><Navbar /><div className="pt-16"><LaunchpadDetailRouter /></div></>} />
      <Route path="/requests/:id" element={<><Navbar /><div className="pt-16"><RequestDetailPage /></div></>} />
      <Route path="/admin" element={<><Navbar /><div className="pt-16"><AdminPage /></div></>} />
      <Route path="/docs" element={<><Navbar /><div className="pt-16"><DocsPage /></div></>} />
      <Route path="/privacy" element={<><Navbar /><div className="pt-16"><PrivacyPage /></div></>} />
      <Route path="/terms" element={<><Navbar /><div className="pt-16"><TermsPage /></div></>} />

      {/* Protected routes */}
      <Route
        path="/launchpad/create"
        element={
          <ProtectedRoute>
            <Navbar />
            <div className="pt-16"><CreateTokenPage /></div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/upload"
        element={
          <ProtectedRoute>
            <Navbar />
            <div className="pt-16"><UploadPage /></div>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <BrowserRouter>
            <ToastProvider>
              <ScrollToTop />
              <AppRoutes />
            </ToastProvider>
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
