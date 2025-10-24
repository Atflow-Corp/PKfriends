import React from 'react';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';

const Header = () => {
  return (
    <header className="bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <Link to="/" className="flex items-center space-x-3">
            <Activity className="h-8 w-8 text-blue-600 dark:text-blue-300" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">TDM Friends</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">Precision Medicine의 시작</p>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header; 