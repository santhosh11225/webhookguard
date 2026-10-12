import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Webhook,
  Boxes,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ArrowUpRight,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Activity,
  Play,
  RotateCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from '../services/api';
import { DashboardAnalytics, TestRun } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardAnalytics();
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadAnalytics();
  };

  const STATUS_COLORS: Record<string, string> = {
    '200': '#10b981',
    '400': '#f59e0b',
    '401': '#a855f7',
    '403': '#ec4899',
    '500': '#f43f5e',
    '503': '#fb7185',
    'TIMEOUT': '#eab308',
    'ERROR': '#ef4444',
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <RotateCw className="w-8 h-8 text-brand-500 animate-spin" />
        <div className="text-sm text-slate-400">Loading reliability metrics...</div>
      </div>
    );
  }

  const successRate = data?.successRate ?? 0;

  return (
    <div className="space-y-8">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">System Overview</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time webhook health telemetry, response latencies, and security status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRefresh}
            loading={refreshing}
            icon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Refresh Data
          </Button>

          <Link to="/suites">
            <Button size="sm" variant="glow" icon={<Play className="w-3.5 h-3.5" />}>
              Execute Test Suite
            </Button>
          </Link>
        </div>
      </div>

      {/* Security Alert Banner if any failures detected */}
      {(data?.securityFailureCount ?? 0) > 0 && (
        <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/50 flex items-start gap-4 shadow-xl security-alert-glow">
          <div className="p-2 rounded-lg bg-purple-600/20 text-purple-400 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 font-bold text-purple-200 text-sm">
              <span>CRITICAL SECURITY WARNING: {data?.securityFailureCount} Forged Webhook(s) Accepted</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                Action Required
              </span>
            </div>
            <p className="text-xs text-purple-300/80 mt-1 leading-relaxed">
              One or more webhook endpoints accepted payloads signed with an invalid HMAC-SHA256 signature
              instead of rejecting them with HTTP 401 Unauthorized.
            </p>
          </div>
          <Link to="/runs">
            <Button size="sm" variant="danger" className="shrink-0 bg-purple-900/60 border-purple-500/40 text-purple-200">
              Inspect Security Log
            </Button>
          </Link>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tests & Pass/Fail */}
        <div className="glass-card p-5 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Total Tests Run</span>
            <Zap className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2 font-mono">
            {data?.totalTests ?? 0}
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {data?.passedTests ?? 0} Passed
            </span>
            <span className="flex items-center gap-1 text-rose-400 font-medium">
              <XCircle className="w-3.5 h-3.5" />
              {data?.failedTests ?? 0} Failed
            </span>
          </div>
        </div>

        {/* Success Rate */}
        <div className="glass-card p-5 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Success Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2 font-mono flex items-baseline gap-1">
            <span>{successRate}%</span>
          </div>
          <div className="w-full bg-dark-800 rounded-full h-1.5 mt-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                successRate > 90 ? 'bg-emerald-500' : successRate > 75 ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, successRate))}%` }}
            />
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="glass-card p-5 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Avg Latency</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2 font-mono flex items-baseline gap-1">
            <span>{data?.avgResponseTime ?? 0}</span>
            <span className="text-sm text-slate-400 font-normal">ms</span>
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
            <span className="text-cyan-400">Timeouts:</span>
            <span className="font-mono text-slate-200">{data?.timeoutCount ?? 0}</span>
            <span className="text-slate-600">|</span>
            <span className="text-amber-400">Retries:</span>
            <span className="font-mono text-slate-200">{data?.retryCount ?? 0}</span>
          </div>
        </div>

        {/* Endpoints & Suites */}
        <div className="glass-card p-5 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <span>Configured Endpoints</span>
            <Webhook className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2 font-mono">
            {data?.totalEndpoints ?? 0}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
            <span>Suites:</span>
            <span className="font-mono text-slate-200 font-semibold">{data?.totalSuites ?? 0} active</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latency Timeline */}
        <div className="lg:col-span-2 glass-card p-5 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Response Latency (ms)</h3>
              <p className="text-xs text-slate-400">Execution time over recent test runs</p>
            </div>
            <span className="text-xs font-mono text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
              Live Telemetry
            </span>
          </div>
          <div className="h-64 w-full">
            {data?.responseTimesOverTime && data.responseTimesOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.responseTimesOverTime}>
                  <defs>
                    <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="timestamp" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="ms" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f1626',
                      borderColor: '#2c3b5e',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="avgTime"
                    name="Latency"
                    stroke="#818cf8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#latencyGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                <Clock className="w-8 h-8 opacity-40 text-slate-400" />
                <span>No latency data yet. Execute a test suite to populate live telemetry.</span>
              </div>
            )}
          </div>
        </div>

        {/* HTTP Status Breakdown Pie */}
        <div className="glass-card p-5 rounded-xl">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-slate-100">HTTP Status Distribution</h3>
            <p className="text-xs text-slate-400">Returned status codes across all tests</p>
          </div>
          <div className="h-56 w-full flex items-center justify-center">
            {data?.statusDistribution && data.statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.statusDistribution}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                  >
                    {data.statusDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.status] || '#6366f1'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f1626',
                      borderColor: '#2c3b5e',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                <Activity className="w-8 h-8 opacity-40 text-slate-400" />
                <span>No status data recorded yet.</span>
              </div>
            )}
          </div>
          {data?.statusDistribution && data.statusDistribution.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[11px]">
              {data.statusDistribution.map((item) => (
                <div key={item.status} className="flex items-center gap-1.5 font-mono">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[item.status] || '#6366f1' }}
                  />
                  <span className="text-slate-300">{item.status}:</span>
                  <span className="text-slate-400 font-bold">{item.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Test Executions Table */}
      <div className="glass-card p-5 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Recent Test Executions</h3>
            <p className="text-xs text-slate-400">Latest automated webhook test runs</p>
          </div>
          <Link to="/runs" className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1">
            <span>View All Runs</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-dark-700 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="pb-3 px-3">Run ID</th>
                <th className="pb-3 px-3">Endpoint / Suite</th>
                <th className="pb-3 px-3">Trigger</th>
                <th className="pb-3 px-3">Results</th>
                <th className="pb-3 px-3">Duration</th>
                <th className="pb-3 px-3">Status</th>
                <th className="pb-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/60 font-mono">
              {(data?.recentRuns || []).map((run) => (
                <tr key={run.id} className="hover:bg-dark-850/50 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-300">
                    <Link to={`/runs/${run.id}`} className="hover:text-brand-400">
                      #{run.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <div className="font-semibold text-slate-200">
                      {run.endpointName || 'Webhook Target'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {run.suiteName || 'Test Suite'}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-dark-800 text-slate-400 border border-dark-700">
                      {run.trigger || 'manual'}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400">{run.passed} pass</span>
                      <span className="text-slate-600">/</span>
                      <span className={run.failed > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                        {run.failed} fail
                      </span>
                      <span className="text-slate-500 text-[11px]">({run.totalTests} total)</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    {run.durationMs ? `${run.durationMs} ms` : '—'}
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="py-3 px-3 text-right font-sans">
                    <Link to={`/runs/${run.id}`}>
                      <Button size="sm" variant="ghost" className="text-xs py-1">
                        Inspect
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
