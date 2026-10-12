import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PlayCircle,
  RotateCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldAlert,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Test Run History</h2>
          <p className="text-xs text-slate-400 mt-1">
            Audit logs of all automated and manual webhook test suite executions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={loadRuns}
            icon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Refresh History
          </Button>

          <Link to="/suites">
            <Button size="sm" variant="glow" icon={<PlayCircle className="w-4 h-4" />}>
              Start New Run
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Run ID, endpoint, or suite name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-dark-900 border border-dark-700/80 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>
        <div className="text-xs text-slate-400">
          Showing {filtered.length} runs
        </div>
      </div>

      {/* Runs Table */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading execution history...</div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-dark-800 flex items-center justify-center mx-auto text-slate-400">
            <PlayCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">No Execution History Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Execute a test suite to view detailed request/response logs and cryptographic validations.
          </p>
          <Link to="/suites">
            <Button size="sm" variant="glow">
              Go to Test Suites
            </Button>
          </Link>
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-dark-700 bg-dark-850/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
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
              <tbody className="divide-y divide-dark-700/60 font-mono">
                {filtered.map((run) => {
                  const passRate = run.totalTests > 0 ? Math.round((run.passed / run.totalTests) * 100) : 0;

                  return (
                    <tr key={run.id} className="hover:bg-dark-850/50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-brand-300">
                        <Link to={`/runs/${run.id}`} className="hover:underline">
                          #{run.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-semibold text-slate-200">
                          {run.endpointName || 'Webhook Endpoint'}
                        </div>
                        <div className="text-[11px] text-slate-400">{run.suiteName || 'Suite'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-dark-800 text-slate-300 border border-dark-700 inline-flex items-center gap-1 font-mono">
                          {run.trigger === 'cicd' && <GitBranch className="w-3 h-3 text-brand-400" />}
                          {run.trigger || 'manual'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold">{run.passed}</span>
                          <span className="text-slate-600">/</span>
                          <span className={run.failed > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                            {run.failed}
                          </span>
                          <span className="text-slate-500 text-[11px]">({passRate}%)</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300">
                        {run.durationMs ? `${run.durationMs} ms` : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-sans text-[11px]">
                        {new Date(run.startedAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-sans">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="py-3.5 px-4 text-right font-sans">
                        <Link to={`/runs/${run.id}`}>
                          <Button size="sm" variant="ghost" className="text-xs py-1" icon={<ArrowRight className="w-3.5 h-3.5" />}>
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
