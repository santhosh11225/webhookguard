import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Shield, ArrowRight } from 'lucide-react';
import { Button } from '../components/common/Button';

export const PublicLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 flex flex-col selection:bg-brand-600 selection:text-white">
      {/* Public Header */}
      <header className="h-20 border-b border-dark-800/80 bg-dark-900/60 backdrop-blur-lg sticky top-0 z-40 px-6 lg:px-12 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-cyan flex items-center justify-center shadow-lg shadow-brand-500/25 group-hover:scale-105 transition-transform">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="font-extrabold text-lg tracking-tight text-white">WebhookGuard</div>
            <div className="text-[11px] text-slate-400 font-mono">API Testing & Reliability</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#use-cases" className="hover:text-white transition-colors">Use Cases</a>
          <a href="#security" className="hover:text-white transition-colors">HMAC Security</a>
          <Link to="/cicd" className="hover:text-white transition-colors">CI/CD API</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/dashboard">
            <Button variant="glow" size="sm" icon={<ArrowRight className="w-4 h-4" />}>
              Open Console
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Public Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-dark-800 bg-dark-950 py-12 px-6 lg:px-12 text-sm text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white">
              <Shield className="w-4 h-4" />
            </div>
            <span className="font-semibold text-slate-200">WebhookGuard</span>
            <span className="text-slate-600">|</span>
            <span className="text-xs text-slate-400">
              Automated Webhook API Testing & Reliability Platform
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs">
            <Link to="/dashboard" className="hover:text-white">Dashboard</Link>
            <Link to="/endpoints" className="hover:text-white">Endpoints</Link>
            <Link to="/suites" className="hover:text-white">Test Suites</Link>
            <Link to="/reports" className="hover:text-white">Reports</Link>
            <Link to="/cicd" className="hover:text-white">CI/CD Gate</Link>
          </div>

          <div className="text-xs text-slate-400">
            Designed with clean layered separation (Frontend → REST API → Services → Repositories).
          </div>
        </div>
      </footer>
    </div>
  );
};
