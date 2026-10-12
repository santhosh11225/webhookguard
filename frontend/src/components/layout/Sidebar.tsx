import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Webhook,
  Boxes,
  PlayCircle,
  FileBarChart2,
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
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 h-screen sticky top-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-gray-200 flex items-center justify-between">
        <NavLink to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-[#333333]">
              WebhookGuard
            </div>
            <div className="text-[11px] text-gray-500 font-mono">
              Testing Platform
            </div>
          </div>
        </NavLink>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-gray-400">
          Core Testing
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600 border border-blue-200'
                  : 'text-gray-700 hover:text-[#333333] hover:bg-gray-50 border border-transparent'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <span className="text-current opacity-90">{item.icon}</span>
              <span>{item.label}</span>
            </div>
            {item.badge && (
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}

        <div className="pt-4 px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-gray-400">
          Public & Docs
        </div>
        <NavLink
          to="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium text-gray-700 hover:text-[#333333] hover:bg-gray-50 transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-gray-400" />
          <span>Landing Page</span>
        </NavLink>
      </nav>

      {/* Footer / Seed Tools */}
      <div className="p-3 border-t border-gray-200 bg-gray-50 space-y-2.5">
        <button
          onClick={handleSeedData}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-semibold text-[#333333] bg-white hover:bg-gray-100 border border-gray-200 transition-colors shadow-sm"
        >
          <Database className="w-3.5 h-3.5 text-blue-600" />
          <span>Reload Sample Data</span>
        </button>

        <div className="flex items-center justify-between px-2 text-[11px] text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-600 inline-block" />
            <span>Local Engine Active</span>
          </div>
          <span className="font-mono text-[10px] text-gray-400">v1.0.0</span>
        </div>
      </div>
    </aside>
  );
};
