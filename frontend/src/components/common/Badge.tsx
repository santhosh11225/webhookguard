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
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-green-50 text-green-700 border border-green-200 ${className}`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
          PASS
        </span>
      );
    case 'FAIL':
    case 'failed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200 ${className}`}
        >
          <XCircle className="w-3.5 h-3.5 text-red-600" />
          FAIL
        </span>
      );
    case 'SECURITY FAILURE':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200 ${className}`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
          SECURITY FAILURE
        </span>
      );
    case 'TIMEOUT':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 ${className}`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          TIMEOUT
        </span>
      );
    case 'running':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          RUNNING
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200 ${className}`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-gray-500" />
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
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200 ${className}`}
        >
          <ShieldCheck className="w-3 h-3 text-blue-600" />
          HMAC-SHA256
        </span>
      );
    case 'bearer':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-gray-100 text-gray-700 border border-gray-200 ${className}`}
        >
          Bearer Token
        </span>
      );
    case 'api_key':
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-gray-100 text-gray-700 border border-gray-200 ${className}`}
        >
          API Key
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-gray-50 text-gray-500 border border-gray-200 ${className}`}
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
          ? 'bg-red-50 text-red-700 border border-red-200'
          : isStaging
          ? 'bg-amber-50 text-amber-700 border border-amber-200'
          : 'bg-gray-100 text-gray-700 border border-gray-200'
      } ${className}`}
    >
      {env}
    </span>
  );
};
