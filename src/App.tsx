import { useEffect, useState, Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import Footer from '@/components/ui/Footer';

// 동적 임포트로 컴포넌트들을 lazy loading
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const TermsAgreement = lazy(() => import('./pages/TermsAgreement'));
const UserRegistration = lazy(() => import('./pages/UserRegistration'));
const ServiceTerms = lazy(() => import('./pages/ServiceTerms'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TDMReportPage = lazy(() => import('./components/TDMReportPage'));

const queryClient = new QueryClient();

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showTermsAgreement, setShowTermsAgreement] = useState(false);
  const [showUserRegistration, setShowUserRegistration] = useState(false);
  const navigate = useNavigate();

  const handleLogin = () => {
    setIsAuthenticated(true);
    try { window.localStorage.setItem('tdmfriends:isAuthenticated', 'true'); } catch {}
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setShowTermsAgreement(false);
    setShowUserRegistration(false);
    try { window.localStorage.removeItem('tdmfriends:isAuthenticated'); } catch {}
    // 로그아웃 후 로그인 페이지로 리다이렉트
    navigate('/');
  };

  const handleShowTermsAgreement = () => {
    setShowTermsAgreement(true);
  };

  const handleBackFromTerms = () => {
    setShowTermsAgreement(false);
  };

  const handleTermsAgreed = () => {
    setShowTermsAgreement(false);
    setShowUserRegistration(true);
  };

  const handleBackFromRegistration = () => {
    setShowUserRegistration(false);
  };

  const handleRegistrationComplete = () => {
    setShowUserRegistration(false);
    // 회원가입 완료 후 자동으로 로그인 처리하여 서비스 홈으로 이동
    setIsAuthenticated(true);
    try { window.localStorage.setItem('tdmfriends:isAuthenticated', 'true'); } catch {}
    console.log("회원가입이 완료되었습니다. 서비스 홈으로 이동합니다.");
  };

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('tdmfriends:isAuthenticated');
      if (saved === 'true') setIsAuthenticated(true);
    } catch {}
  }, []);

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    }>
      <Routes>
        {/* 인증되지 않은 상태에서 접근 가능한 페이지들 */}
        <Route path="/terms" element={<ServiceTerms />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        
        {/* 인증된 상태에서만 접근 가능한 페이지들 */}
        {isAuthenticated ? (
          <>
            <Route path="/" element={<Index onLogout={handleLogout} />} />
            <Route path="/report" element={<TDMReportPage />} />
            <Route path="*" element={<NotFound />} />
          </>
        ) : (
          <>
            {/* 인증되지 않은 상태에서의 페이지들 */}
            {showUserRegistration ? (
              <Route path="*" element={<UserRegistration onBack={handleBackFromRegistration} onComplete={handleRegistrationComplete} />} />
            ) : showTermsAgreement ? (
              <Route path="*" element={<TermsAgreement onBack={handleBackFromTerms} onAgree={handleTermsAgreed} />} />
            ) : (
              <Route path="*" element={<LoginPage onLogin={handleLogin} onShowTermsAgreement={handleShowTermsAgreement} />} />
            )}
          </>
        )}
      </Routes>
      <Footer />
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename="/PKfriends/">
          <AppContent />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
