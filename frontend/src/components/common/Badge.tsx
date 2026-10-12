import React from 'react';
import { ShieldAlert, CheckCircle2, XCircle, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { TestResultStatus, AuthType, Environment } from '../../types';

export const StatusBadge: React.FC<{ status: TestResultStatus | string; className?: string }> = ({
  status,
  className = '',
}) => {
  switch (status) {
    case 'PASS':
    case 'passed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 ${className}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          PASS
        </span>
      );
    case 'FAIL':
    case 'failed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30 ${className}`}
        >
          <XCircle className="w-3.5 h-3.5" />
          FAIL
        </span>
      );
    case 'SECURITY FAILURE':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-600/20 text-purple-300 border border-purple-500/60 shadow-lg shadow-purple-500/20 animate-pulse ${className}`}
        >
          <ShieldAlert className="w-4 h-4 text-purple-400 animate-bounce" />
          SECURITY FAILURE
        </span>
      );
    case 'TIMEOUT':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 ${className}`}
        >
          <Clock className="w-3.5 h-3.5" />
          TIMEOUT
        </span>
      );
    case 'running':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
          RUNNING
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/50 text-slate-300 border border-slate-600/40 ${className}`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {status}
        </span>
      );
  }
};

export const AuthBadge: React.FC<{ auth: AuthType; className?: string }> = ({ auth, className = '' }) => {
  switch (auth) {
    case 'hmac':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 ${className}`}
        >
          <ShieldCheck className="w-3 h-3 text-indigo-400" />
          HMAC-SHA256
        </span>
      );
    case 'bearer':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 ${className}`}
        >
          Bearer Token
        </span>
      );
    case 'api_key':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 ${className}`}
        >
          API Key
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700 ${className}`}
        >
          No Auth
        </span>
      );
  }
};

export const EnvBadge: React.FC<{ env: Environment | string; className?: string }> = ({
  env,
  className = '',
}) => {
  const isProd = env === 'production';
  const isStaging = env === 'staging';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] uppercase font-bold tracking-wider ${
        isProd
          ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
          : isStaging
          ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
          : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
      } ${className}`}
    >
      {env}
    </span>
  );
};
