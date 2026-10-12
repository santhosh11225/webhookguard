import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play, RotateCw } from 'lucide-react';
import { api } from '../services/api';
import { DashboardAnalytics, TestRun } from '../types';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const [analytics, recentRuns] = await Promise.all([
        api.getDashboardAnalytics(),
        api.getTestRuns({ limit: 10 }),
      ]);
      setData(analytics);
      setRuns(recentRuns);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        Loading dashboard...
      </div>
    );
  }

  const totalRuns = runs.length > 0 ? (data?.recentRuns?.length ?? runs.length) : (data?.recentRuns?.length ?? 0);
  const passedTests = data?.passedTests ?? 0;
  const failedTests = data?.failedTests ?? 0;

  return (
    <div className="space-y-6">
      {/* Header and Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-[#333333] tracking-tight">Dashboard</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Overview of automated webhook test runs and execution status.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={loadDashboard}
            icon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Link to="/suites">
            <Button size="sm" variant="primary" icon={<Play className="w-3.5 h-3.5" />}>
              Go to Test Suites
            </Button>
          </Link>
        </div>
      </div>

      {/* A. Compact Statistics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 p-4 rounded-lg">
          <div className="text-xs font-medium text-gray-500">Total Test Runs</div>
          <div className="text-2xl font-bold text-[#333333] mt-1 font-mono">
            {totalRuns}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4 rounded-lg">
          <div className="text-xs font-medium text-gray-500">Passed Tests</div>
          <div className="text-2xl font-bold text-green-600 mt-1 font-mono">
            {passedTests}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4 rounded-lg">
          <div className="text-xs font-medium text-gray-500">Failed Tests</div>
          <div className="text-2xl font-bold text-red-600 mt-1 font-mono">
            {failedTests}
          </div>
        </div>
      </div>

      {/* B. Recent Test Runs Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#333333]">Recent Test Runs</h3>
          <Link to="/runs" className="text-xs text-blue-600 hover:underline">
            View all runs
          </Link>
        </div>

        {runs.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500">
            No test runs recorded yet. Use the Test Suites page to execute your first test suite.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-medium">
                  <th className="pb-2.5 px-3">Run ID</th>
                  <th className="pb-2.5 px-3">Test Suite</th>
                  <th className="pb-2.5 px-3">Endpoint</th>
                  <th className="pb-2.5 px-3">Status</th>
                  <th className="pb-2.5 px-3">Results</th>
                  <th className="pb-2.5 px-3">Execution Time</th>
                  <th className="pb-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-mono text-gray-700">
                      #{run.id.slice(0, 8)}
                    </td>
                    <td className="py-2.5 px-3 text-[#333333] font-medium">
                      {run.suiteName || 'Test Suite'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">
                      {run.endpointName || 'Webhook Endpoint'}
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={run.status} />
                    </td>
                    <td className="py-2.5 px-3 font-mono text-gray-700">
                      {run.passed} / {run.totalTests} pass
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">
                      {new Date(run.startedAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Link to={`/runs/${run.id}`}>
                        <Button size="sm" variant="secondary" className="text-xs py-1 px-2.5">
                          View Details
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
