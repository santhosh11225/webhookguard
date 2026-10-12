import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PlayCircle,
  RotateCw,
  Search,
  ArrowRight,
  GitBranch,
} from 'lucide-react';
import { api } from '../services/api';
import { TestRun } from '../types';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';
import { useToast } from '../context/ToastContext';

export const TestRunsPage: React.FC = () => {
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const endpointId = searchParams.get('endpointId') || '';

  const toast = useToast();

  const loadRuns = async () => {
    try {
      setLoading(true);
      const list = await api.getTestRuns({ endpointId: endpointId || undefined });
      setRuns(list);
    } catch (err: any) {
      toast.error('Failed to load runs', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, [endpointId]);

  const filtered = runs.filter(
    (r) =>
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      (r.endpointName && r.endpointName.toLowerCase().includes(search.toLowerCase())) ||
      (r.suiteName && r.suiteName.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-[#333333] tracking-tight">Test Run History</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Audit logs of all automated and manual webhook test suite executions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={loadRuns}
            icon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Refresh History
          </Button>

          <Link to="/suites">
            <Button size="sm" variant="primary" icon={<PlayCircle className="w-4 h-4" />}>
              Start New Run
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white border border-gray-200 p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Run ID, endpoint, or suite name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded pl-9 pr-4 py-2 text-xs text-[#333333] placeholder-gray-400 focus:outline-none focus:border-blue-600"
          />
        </div>
        <div className="text-xs text-gray-500">
          Showing {filtered.length} runs
        </div>
      </div>

      {/* Runs Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Loading execution history...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center rounded-lg space-y-4">
          <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center mx-auto text-gray-500">
            <PlayCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-[#333333]">No Execution History Found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Execute a test suite to view detailed request/response logs and cryptographic validations.
          </p>
          <Link to="/suites">
            <Button size="sm" variant="primary">
              Go to Test Suites
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Run Identifier</th>
                  <th className="py-3 px-4">Target Webhook</th>
                  <th className="py-3 px-4">Trigger</th>
                  <th className="py-3 px-4">Pass / Fail Ratio</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Executed At</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {filtered.map((run) => {
                  const passRate = run.totalTests > 0 ? Math.round((run.passed / run.totalTests) * 100) : 0;

                  return (
                    <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-blue-600">
                        <Link to={`/runs/${run.id}`} className="hover:underline">
                          #{run.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-semibold text-[#333333]">
                          {run.endpointName || 'Webhook Endpoint'}
                        </div>
                        <div className="text-[11px] text-gray-500">{run.suiteName || 'Suite'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-gray-100 text-[#333333] border border-gray-200 inline-flex items-center gap-1 font-mono">
                          {run.trigger === 'cicd' && <GitBranch className="w-3 h-3 text-blue-600" />}
                          {run.trigger || 'manual'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-green-700 font-bold">{run.passed}</span>
                          <span className="text-gray-400">/</span>
                          <span className={run.failed > 0 ? 'text-red-700 font-bold' : 'text-gray-500'}>
                            {run.failed}
                          </span>
                          <span className="text-gray-400 text-[11px]">({passRate}%)</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-700">
                        {run.durationMs ? `${run.durationMs} ms` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 font-sans text-[11px]">
                        {new Date(run.startedAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right font-sans">
                        <Link to={`/runs/${run.id}`}>
                          <Button size="sm" variant="ghost" className="text-xs py-1 text-gray-600 hover:text-[#333333]" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                            View Results
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
