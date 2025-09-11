import { useEffect, useState, Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Footer from '@/components/ui/Footer';

// 동적 임포트로 컴포넌트들을 lazy loading
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LoginPage = lazy(() => import('./pages/LoginPage'));

const queryClient = new QueryClient();

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => {
    setIsAuthenticated(true);
    try { window.localStorage.setItem('tdmfriends:isAuthenticated', 'true'); } catch {}
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try { window.localStorage.removeItem('tdmfriends:isAuthenticated'); } catch {}
  };

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('tdmfriends:isAuthenticated');
      if (saved === 'true') setIsAuthenticated(true);
    } catch {}
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename="/PKfriends/">
          {!isAuthenticated ? (
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
              </div>
            }>
              <LoginPage onLogin={handleLogin} />
              <Footer />
            </Suspense>
          ) : (
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
              </div>
            }>
              <Routes>
                <Route path="/" element={<Index onLogout={handleLogout} />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Footer />
            </Suspense>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
