import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="w-full py-4 px-6 bg-slate-50 border-t text-center text-sm text-muted-foreground">
      <Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary mx-2">서비스 이용약관</Link>
      |
      <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary mx-2">개인정보처리방침</Link>
    </footer>
  );
};

export default Footer; 