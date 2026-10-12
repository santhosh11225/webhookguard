import React, { useState, useEffect } from 'react';
import {
  Activity,
  TrendingDown,
  Clock,
  ShieldAlert,
  Repeat,
  RotateCw,
  Zap,
  CheckCircle2,
  AlertOctagon,
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
  LineChart,
  Line,
} from 'recharts';
import { api } from '../services/api';
import { DashboardAnalytics } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';

export const MonitoringPage: React.FC = () => {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardAnalytics();
      setData(res);
    } catch (err) {
      console.error('Failed to load metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const failureRate =
    data && data.totalTests > 0
      ? Math.round((data.failedTests / data.totalTests) * 1000) / 10
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Reliability & SLA Monitoring</h2>
          <p className="text-xs text-slate-400 mt-1">
            Operational reliability metrics, latency percentiles, and automated incident flags.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={loadMetrics}
            icon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* Primary Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-xl border-l-4 border-l-brand-500">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase">
            <span>Total Executions</span>
            <Activity className="w-4 h-4 text-brand-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2 font-mono">
            {data?.totalTests ?? 0}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Across {data?.totalEndpoints ?? 0} endpoints and {data?.totalSuites ?? 0} suites
          </div>
        </div>

        <div className="glass-card p-5 rounded-xl border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase">
            <span>Global Failure Rate</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2 font-mono">
            {failureRate}%
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {data?.failedTests ?? 0} failed assertions total
          </div>
        </div>

        <div className="glass-card p-5 rounded-xl border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase">
            <span>Average SLA Latency</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2 font-mono">
            {data?.avgResponseTime ?? 0} <span className="text-sm font-normal text-slate-400">ms</span>
          </div>
          <div className="text-xs text-slate-400 mt-2">Network roundtrip + server processing</div>
        </div>

        <div className="glass-card p-5 rounded-xl border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase">
            <span>Security Incidents</span>
            <ShieldAlert className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-3xl font-extrabold text-purple-300 mt-2 font-mono">
            {data?.securityFailureCount ?? 0}
          </div>
          <div className="text-xs text-slate-400 mt-2">Forged HMAC signatures accepted</div>
        </div>

        <div className="glass-card p-5 rounded-xl border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase">
            <span>Timeout Breaches</span>
            <AlertOctagon className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-300 mt-2 font-mono">
            {data?.timeoutCount ?? 0}
          </div>
          <div className="text-xs text-slate-400 mt-2">Exceeded configured SLA timeout limit</div>
        </div>

        <div className="glass-card p-5 rounded-xl border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 uppercase">
            <span>Retry Recoveries</span>
            <Repeat className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-300 mt-2 font-mono">
            {data?.retryCount ?? 0}
          </div>
          <div className="text-xs text-slate-400 mt-2">Transient outages rescued by retries</div>
        </div>
      </div>

      {/* Monitoring Telemetry Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Success Rate Trend (%)</h3>
              <p className="text-xs text-slate-400">Reliability percentage across recent executions</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.successRateTrends || []}>
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f1626',
                    borderColor: '#2c3b5e',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="successRate"
                  name="Success Rate"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ fill: '#10b981', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card p-5 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Response Latency Distribution</h3>
              <p className="text-xs text-slate-400">Average response time in milliseconds</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.responseTimesOverTime || []}>
                <XAxis dataKey="timestamp" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} unit="ms" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f1626',
                    borderColor: '#2c3b5e',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="avgTime" name="Response Time" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
