import React, { useState, useEffect } from 'react';
import {
  Activity,
  TrendingDown,
  Clock,
  ShieldAlert,
  Repeat,
  RotateCw,
  AlertOctagon,
} from 'lucide-react';
import {
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

  if (loading && !data) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        Loading reliability metrics...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-[#333333] tracking-tight">Reliability & SLA Monitoring</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Operational reliability metrics, latency percentiles, and automated incident flags.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
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
        <div className="bg-white border border-gray-200 p-5 rounded-lg">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase">
            <span>Total Executions</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-[#333333] mt-2 font-mono">
            {data?.totalTests ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Across {data?.totalEndpoints ?? 0} endpoints and {data?.totalSuites ?? 0} suites
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-lg">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase">
            <span>Global Failure Rate</span>
            <TrendingDown className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-extrabold text-red-600 mt-2 font-mono">
            {failureRate}%
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {data?.failedTests ?? 0} failed assertions total
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-lg">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase">
            <span>Average SLA Latency</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-[#333333] mt-2 font-mono">
            {data?.avgResponseTime ?? 0} <span className="text-sm font-normal text-gray-500">ms</span>
          </div>
          <div className="text-xs text-gray-500 mt-2">Network roundtrip + server processing</div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-lg">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase">
            <span>Security Incidents</span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-extrabold text-red-600 mt-2 font-mono">
            {data?.securityFailureCount ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-2">Forged HMAC signatures accepted</div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-lg">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase">
            <span>Timeout Breaches</span>
            <AlertOctagon className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-700 mt-2 font-mono">
            {data?.timeoutCount ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-2">Exceeded configured SLA timeout limit</div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-lg">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase">
            <span>Retry Recoveries</span>
            <Repeat className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-blue-600 mt-2 font-mono">
            {data?.retryCount ?? 0}
          </div>
          <div className="text-xs text-gray-500 mt-2">Transient outages rescued by retries</div>
        </div>
      </div>

      {/* Monitoring Telemetry Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 p-5 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#333333]">Success Rate Trend (%)</h3>
              <p className="text-xs text-gray-500">Reliability percentage across recent executions</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.successRateTrends || []}>
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={11} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#333333',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="successRate"
                  name="Success Rate"
                  stroke="#16a34a"
                  strokeWidth={2}
                  dot={{ fill: '#16a34a', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[#333333]">Response Latency Distribution</h3>
              <p className="text-xs text-gray-500">Average response time in milliseconds</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.responseTimesOverTime || []}>
                <XAxis dataKey="timestamp" stroke="#9ca3af" fontSize={11} />
                <YAxis stroke="#9ca3af" fontSize={11} unit="ms" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e5e7eb',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#333333',
                  }}
                />
                <Bar dataKey="avgTime" name="Response Time" fill="#2563eb" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
