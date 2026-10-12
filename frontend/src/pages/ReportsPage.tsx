import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  FileBarChart2,
  Printer,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  RotateCw,
  Repeat,
  ExternalLink,
  Shield,
} from 'lucide-react';
import { api } from '../services/api';
import { ReportSummary, TestRun } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { StatusBadge, EnvBadge } from '../components/common/Badge';
import { useToast } from '../context/ToastContext';

export const ReportsPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>(runId || '');
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const toast = useToast();

  useEffect(() => {
    api.getTestRuns({ limit: 50 }).then((allRuns) => {
      setRuns(allRuns);
      if (!selectedRunId && allRuns.length > 0) {
        setSelectedRunId(allRuns[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedRunId) return;
    setLoading(true);
    api
      .getReport(selectedRunId)
      .then((data) => setReport(data))
      .catch((err) => toast.error('Failed to load report', err.message))
      .finally(() => setLoading(false));
  }, [selectedRunId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `webhookguard-report-${report.run.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report Downloaded', 'Exported JSON summary to your device.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls (Hidden on Print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Reliability & Compliance Report</h2>
          <p className="text-xs text-slate-400 mt-1">
            Executive audit report summarizing webhook SLA compliance, security posture, and error rates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Select Run */}
          <select
            value={selectedRunId}
            onChange={(e) => setSelectedRunId(e.target.value)}
            className="bg-dark-900 border border-dark-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-mono"
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                #{r.id.slice(0, 8)} - {r.endpointName || 'Webhook'} ({r.status.toUpperCase()})
              </option>
            ))}
          </select>

          <Button
            size="sm"
            variant="secondary"
            onClick={handleDownloadJson}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Download JSON
          </Button>

          <Button
            size="sm"
            variant="glow"
            onClick={handlePrint}
            icon={<Printer className="w-3.5 h-3.5" />}
          >
            Print Report
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Generating compliance report...</div>
      ) : !report ? (
        <div className="glass-panel p-12 text-center rounded-2xl">
          <h3 className="text-base font-bold text-slate-200">No Report Selected</h3>
          <p className="text-xs text-slate-400 mt-1">Select a test execution run to generate an audit report.</p>
        </div>
      ) : (
        /* Printable Report Document */
        <div className="glass-panel p-8 rounded-2xl space-y-8 print:p-0 print:border-none print:shadow-none print:bg-white print:text-black">
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-dark-700/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white print:text-black">
                  Webhook Reliability Audit Report
                </h1>
                <p className="text-xs text-slate-400 print:text-gray-600 font-mono">
                  Execution ID: {report.run.id}
                </p>
              </div>
            </div>

            <div className="text-right text-xs font-mono text-slate-400 print:text-gray-600">
              <div>Generated: {new Date().toLocaleString()}</div>
              <div>Trigger: {report.run.trigger || 'manual'}</div>
            </div>
          </div>

          {/* Target Webhook Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-dark-900/90 p-5 rounded-xl border border-dark-800 print:bg-gray-100 print:text-black">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Endpoint Name</div>
              <div className="text-sm font-semibold text-slate-100 print:text-black mt-1">
                {report.endpoint.name}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5 truncate">{report.endpoint.url}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Test Suite</div>
              <div className="text-sm font-semibold text-slate-100 print:text-black mt-1">{report.suite.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">{report.endpoint.environment}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Authentication Type</div>
              <div className="text-sm font-semibold text-slate-100 print:text-black mt-1 uppercase">
                {report.endpoint.authentication}
              </div>
              <div className="text-xs text-slate-400 mt-0.5 font-mono">
                Duration: {report.run.durationMs ?? 0} ms
              </div>
            </div>
          </div>

          {/* Executive Metrics Overview */}
          <div>
            <h3 className="text-sm font-bold text-white print:text-black uppercase tracking-wider mb-3">
              Executive Metrics Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 print:bg-gray-50">
                <div className="text-xs text-slate-400">Total Tests</div>
                <div className="text-2xl font-extrabold text-white print:text-black font-mono mt-1">
                  {report.metrics.total}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 print:bg-gray-50">
                <div className="text-xs text-slate-400">Passed / Failed</div>
                <div className="text-2xl font-extrabold font-mono mt-1 flex items-center gap-1.5">
                  <span className="text-emerald-400 print:text-green-700">{report.metrics.passed}</span>
                  <span className="text-slate-600">/</span>
                  <span className={report.metrics.failed > 0 ? 'text-rose-400 print:text-red-700' : 'text-slate-400'}>
                    {report.metrics.failed}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 print:bg-gray-50">
                <div className="text-xs text-slate-400">Success Rate</div>
                <div className="text-2xl font-extrabold text-white print:text-black font-mono mt-1">
                  {report.metrics.successRate}%
                </div>
              </div>

              <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 print:bg-gray-50">
                <div className="text-xs text-slate-400">Average Latency</div>
                <div className="text-2xl font-extrabold text-cyan-400 print:text-blue-700 font-mono mt-1">
                  {report.metrics.avgResponseTime} ms
                </div>
              </div>
            </div>
          </div>

          {/* Risk and Failure Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 print:bg-purple-50">
              <div className="flex items-center gap-2 font-bold text-purple-300 print:text-purple-900 text-xs uppercase">
                <ShieldAlert className="w-4 h-4" />
                <span>Security Failures</span>
              </div>
              <div className="text-2xl font-extrabold text-purple-200 print:text-purple-950 font-mono mt-1">
                {report.metrics.securityFailures}
              </div>
              <p className="text-[11px] text-slate-400 print:text-gray-600 mt-1">
                Endpoints accepting invalid signatures
              </p>
            </div>

            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 print:bg-amber-50">
              <div className="flex items-center gap-2 font-bold text-amber-300 print:text-amber-900 text-xs uppercase">
                <Clock className="w-4 h-4" />
                <span>Timeout Failures</span>
              </div>
              <div className="text-2xl font-extrabold text-amber-200 print:text-amber-950 font-mono mt-1">
                {report.metrics.timeoutFailures}
              </div>
              <p className="text-[11px] text-slate-400 print:text-gray-600 mt-1">
                Requests exceeding configured SLA threshold
              </p>
            </div>

            <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 print:bg-cyan-50">
              <div className="flex items-center gap-2 font-bold text-cyan-300 print:text-cyan-900 text-xs uppercase">
                <Repeat className="w-4 h-4" />
                <span>Retry Failures</span>
              </div>
              <div className="text-2xl font-extrabold text-cyan-200 print:text-cyan-950 font-mono mt-1">
                {report.metrics.retryFailures}
              </div>
              <p className="text-[11px] text-slate-400 print:text-gray-600 mt-1">
                Scenarios failing even after multiple attempts
              </p>
            </div>
          </div>

          {/* Test Results Table in Report */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white print:text-black uppercase tracking-wider">
              Scenario Audit Breakdown
            </h3>
            <table className="w-full text-left text-xs border border-dark-700 print:border-gray-300">
              <thead className="bg-dark-900 print:bg-gray-100 text-slate-400 print:text-black font-semibold text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 border-b border-dark-700 print:border-gray-300">Test Scenario</th>
                  <th className="py-2.5 px-3 border-b border-dark-700 print:border-gray-300">Type</th>
                  <th className="py-2.5 px-3 border-b border-dark-700 print:border-gray-300">Expected</th>
                  <th className="py-2.5 px-3 border-b border-dark-700 print:border-gray-300">Actual</th>
                  <th className="py-2.5 px-3 border-b border-dark-700 print:border-gray-300">Latency</th>
                  <th className="py-2.5 px-3 border-b border-dark-700 print:border-gray-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/60 print:divide-gray-200 font-mono">
                {report.results.map((r, i) => (
                  <tr key={i}>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-200 print:text-black">
                      {r.testName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 print:text-gray-700 uppercase text-[10px]">
                      {r.testType}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 print:text-black">HTTP {r.expectedStatus}</td>
                    <td className="py-2.5 px-3">
                      {r.actualStatus ? `HTTP ${r.actualStatus}` : 'TIMEOUT'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 print:text-black">{r.responseTime} ms</td>
                    <td className="py-2.5 px-3 font-sans">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signoff Footer */}
          <div className="pt-8 border-t border-dark-700/80 flex items-center justify-between text-xs text-slate-500 print:text-gray-600">
            <div>WebhookGuard Platform • Automated Reliability Certification</div>
            <div>Signoff: QA / DevOps Automated Quality Gate</div>
          </div>
        </div>
      )}
    </div>
  );
};
