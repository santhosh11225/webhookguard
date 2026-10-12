import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Shield, ArrowRight } from 'lucide-react';
import { Button } from '../components/common/Button';

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#333333] flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-gray-200 bg-white px-6 lg:px-12 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-bold text-base text-[#333333] tracking-tight">WebhookGuard</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="secondary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
              Dashboard
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6 px-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>WebhookGuard — Automated Webhook Testing & Reliability Engine</div>
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="hover:text-blue-600">Dashboard</Link>
            <Link to="/endpoints" className="hover:text-blue-600">Endpoints</Link>
            <Link to="/suites" className="hover:text-blue-600">Test Suites</Link>
            <Link to="/cicd" className="hover:text-blue-600">CI/CD Gate</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
