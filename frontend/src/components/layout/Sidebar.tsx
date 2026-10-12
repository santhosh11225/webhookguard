import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Webhook,
  Boxes,
  PlayCircle,
  FileBarChart2,
  Activity,
  GitBranch,
  Shield,
  Database,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: string;
}

export const Sidebar: React.FC = () => {
  const toast = useToast();

  const navItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: 'Endpoints', path: '/endpoints', icon: <Webhook className="w-4 h-4" /> },
    { label: 'Test Suites', path: '/suites', icon: <Boxes className="w-4 h-4" /> },
    { label: 'Test Runs', path: '/runs', icon: <PlayCircle className="w-4 h-4" /> },
    { label: 'Reports', path: '/reports', icon: <FileBarChart2 className="w-4 h-4" /> },
    { label: 'Monitoring', path: '/monitoring', icon: <Activity className="w-4 h-4" /> },
    { label: 'CI/CD Gate', path: '/cicd', icon: <GitBranch className="w-4 h-4" />, badge: 'API' },
  ];

  const handleSeedData = async () => {
    try {
      await api.seedDatabase();
      toast.success('Database Seeded', 'Loaded realistic sample endpoints, test suites, and runs.');
      window.location.reload();
    } catch (err: any) {
      toast.error('Seed Failed', err.message);
    }
  };

  return (
    <aside className="w-64 bg-dark-900 border-r border-dark-700/70 flex flex-col shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-dark-700/60 flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-cyan flex items-center justify-center shadow-lg shadow-brand-500/25 group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              WebhookGuard
            </div>
            <div className="text-[10px] text-slate-400 font-mono tracking-wide">
              API Reliability Platform
            </div>
          </div>
        </NavLink>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-500">
          Core Testing
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-brand-600/20 text-brand-300 border border-brand-500/30 shadow-sm shadow-brand-600/10'
                  : 'text-slate-300 hover:text-white hover:bg-dark-800/80 border border-transparent'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <span className="text-current opacity-90">{item.icon}</span>
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-brand-500/20 text-brand-300 border border-brand-500/30">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}

        <div className="pt-4 px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-500">
          Public & Docs
        </div>
        <NavLink
          to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-dark-800/80 transition-all"
        >
          <ExternalLink className="w-4 h-4 text-slate-400" />
          <span>Landing Page</span>
        </NavLink>
      </nav>

      {/* Footer / Seed Tools */}
      <div className="p-3 border-t border-dark-700/60 bg-dark-950/40 space-y-2.5">
        <button
          onClick={handleSeedData}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-dark-800 hover:bg-dark-700 border border-dark-600 hover:border-brand-500/50 hover:text-brand-300 transition-all shadow-sm"
        >
          <Database className="w-3.5 h-3.5 text-brand-400" />
          <span>Reload Sample Data</span>
        </button>

        <div className="flex items-center justify-between px-2 text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
            <span>Local Engine Active</span>
          </div>
          <span className="font-mono text-[10px]">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};
