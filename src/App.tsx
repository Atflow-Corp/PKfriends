import { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from './pages/LoginPage';
import Footer from '@/components/ui/Footer';

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
            <>
              <LoginPage onLogin={handleLogin} />
              <Footer />
            </>
          ) : (
            <>
              <Routes>
                <Route path="/" element={<Index onLogout={handleLogout} />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Footer />
            </>
          )}
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
