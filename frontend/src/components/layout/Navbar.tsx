import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Zap, Terminal } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../common/Button';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    api
      .getHealth()
      .then(() => setIsOnline(true))
      .catch(() => setIsOnline(false));
  }, [location.pathname]);

  const getPageTitle = (path: string) => {
    if (path.startsWith('/dashboard')) return 'System Dashboard';
    if (path.startsWith('/endpoints')) return 'Endpoint Management';
    if (path.startsWith('/suites')) return 'Test Suite Builder';
    if (path.startsWith('/runs')) return 'Execution History';
    if (path.startsWith('/reports')) return 'Reliability & Compliance Reports';
    if (path.startsWith('/monitoring')) return 'Real-time Reliability Metrics';
    if (path.startsWith('/cicd')) return 'CI/CD Pipeline Quality Gate';
    return 'Webhook Reliability Platform';
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-[#333333] tracking-tight">
          {getPageTitle(location.pathname)}
        </h1>
        <span className="hidden sm:inline-block text-xs font-mono text-gray-300">|</span>
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-gray-50 text-gray-600 border border-gray-200">
          <Terminal className="w-3 h-3 text-blue-600" />
          http://localhost:4000/api
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Backend Status Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border ${
            isOnline
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-700 border-red-200'
          }`}
          title={isOnline ? 'Local REST API Connected' : 'Cannot reach backend server'}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-green-600' : 'bg-red-600'
            }`}
          />
          <span className="text-[11px]">{isOnline ? 'API Connected' : 'API Offline'}</span>
        </div>

        <Link to="/suites">
          <Button size="sm" variant="primary" icon={<Zap className="w-3.5 h-3.5" />}>
            Run Test Suite
          </Button>
        </Link>
      </div>
    </header>
  );
};
