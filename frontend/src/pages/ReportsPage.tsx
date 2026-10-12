import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Printer,
  Download,
  Clock,
  ShieldAlert,
  Repeat,
  Shield,
} from 'lucide-react';
import { api } from '../services/api';
import { ReportSummary, TestRun } from '../types';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/Badge';
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
  }, [selectedRunId, toast]);

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
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-[#333333] tracking-tight">Reliability & Compliance Report</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Executive audit report summarizing webhook SLA compliance, security posture, and error rates.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Select Run */}
          <select
            value={selectedRunId}
            onChange={(e) => setSelectedRunId(e.target.value)}
            className="bg-white border border-gray-200 rounded px-3 py-1.5 text-xs text-[#333333] focus:outline-none focus:border-blue-600 font-mono"
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
            variant="primary"
            onClick={handlePrint}
            icon={<Printer className="w-3.5 h-3.5" />}
          >
            Print Report
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500 text-sm">Generating compliance report...</div>
      ) : !report ? (
        <div className="bg-white border border-gray-200 p-12 text-center rounded-lg">
          <h3 className="text-base font-bold text-[#333333]">No Report Selected</h3>
          <p className="text-xs text-gray-500 mt-1">Select a test execution run to generate an audit report.</p>
        </div>
      ) : (
        /* Printable Report Document */
        <div className="bg-white border border-gray-200 rounded-lg p-8 space-y-8 print:p-0 print:border-none print:shadow-none print:bg-white print:text-black">
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center text-white">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#333333] print:text-black">
                  Webhook Reliability Audit Report
                </h1>
                <p className="text-xs text-gray-500 print:text-gray-600 font-mono">
                  Execution ID: {report.run.id}
                </p>
              </div>
            </div>

            <div className="text-right text-xs font-mono text-gray-500 print:text-gray-600">
              <div>Generated: {new Date().toLocaleString()}</div>
              <div>Trigger: {report.run.trigger || 'manual'}</div>
            </div>
          </div>

          {/* Target Webhook Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200 print:bg-gray-100 print:text-black">
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Endpoint Name</div>
              <div className="text-sm font-semibold text-[#333333] print:text-black mt-1">
                {report.endpoint.name}
              </div>
              <div className="text-xs font-mono text-gray-500 mt-0.5 truncate">{report.endpoint.url}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Test Suite</div>
              <div className="text-sm font-semibold text-[#333333] print:text-black mt-1">{report.suite.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">{report.endpoint.environment}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Authentication Type</div>
              <div className="text-sm font-semibold text-[#333333] print:text-black mt-1 uppercase">
                {report.endpoint.authentication}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 font-mono">
                Duration: {report.run.durationMs ?? 0} ms
              </div>
            </div>
          </div>

          {/* Executive Metrics Overview */}
          <div>
            <h3 className="text-sm font-bold text-[#333333] print:text-black uppercase tracking-wider mb-3">
              Executive Metrics Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 print:bg-gray-50">
                <div className="text-xs text-gray-500">Total Tests</div>
                <div className="text-2xl font-extrabold text-[#333333] print:text-black font-mono mt-1">
                  {report.metrics.total}
                </div>
              </div>

              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 print:bg-gray-50">
                <div className="text-xs text-gray-500">Passed / Failed</div>
                <div className="text-2xl font-extrabold font-mono mt-1 flex items-center gap-1.5">
                  <span className="text-green-700 print:text-green-700">{report.metrics.passed}</span>
                  <span className="text-gray-400">/</span>
                  <span className={report.metrics.failed > 0 ? 'text-red-700 print:text-red-700' : 'text-gray-500'}>
                    {report.metrics.failed}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 print:bg-gray-50">
                <div className="text-xs text-gray-500">Success Rate</div>
                <div className="text-2xl font-extrabold text-[#333333] print:text-black font-mono mt-1">
                  {report.metrics.successRate}%
                </div>
              </div>

              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 print:bg-gray-50">
                <div className="text-xs text-gray-500">Average Latency</div>
                <div className="text-2xl font-extrabold text-blue-600 print:text-blue-700 font-mono mt-1">
                  {report.metrics.avgResponseTime} ms
                </div>
              </div>
            </div>
          </div>

          {/* Risk and Failure Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 print:bg-gray-50">
              <div className="flex items-center gap-2 font-bold text-[#333333] print:text-black text-xs uppercase">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <span>Security Failures</span>
              </div>
              <div className="text-2xl font-extrabold text-[#333333] print:text-black font-mono mt-1">
                {report.metrics.securityFailures}
              </div>
              <p className="text-[11px] text-gray-500 print:text-gray-600 mt-1">
                Endpoints accepting invalid signatures
              </p>
            </div>

            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 print:bg-gray-50">
              <div className="flex items-center gap-2 font-bold text-[#333333] print:text-black text-xs uppercase">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Timeout Failures</span>
              </div>
              <div className="text-2xl font-extrabold text-[#333333] print:text-black font-mono mt-1">
                {report.metrics.timeoutFailures}
              </div>
              <p className="text-[11px] text-gray-500 print:text-gray-600 mt-1">
                Requests exceeding configured SLA threshold
              </p>
            </div>

            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 print:bg-gray-50">
              <div className="flex items-center gap-2 font-bold text-[#333333] print:text-black text-xs uppercase">
                <Repeat className="w-4 h-4 text-blue-600" />
                <span>Retry Failures</span>
              </div>
              <div className="text-2xl font-extrabold text-[#333333] print:text-black font-mono mt-1">
                {report.metrics.retryFailures}
              </div>
              <p className="text-[11px] text-gray-500 print:text-gray-600 mt-1">
                Scenarios failing even after multiple attempts
              </p>
            </div>
          </div>

          {/* Test Results Table in Report */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#333333] print:text-black uppercase tracking-wider">
              Scenario Audit Breakdown
            </h3>
            <table className="w-full text-left text-xs border border-gray-200 print:border-gray-300">
              <thead className="bg-gray-50 print:bg-gray-100 text-gray-600 print:text-black font-semibold text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 border-b border-gray-200 print:border-gray-300">Test Scenario</th>
                  <th className="py-2.5 px-3 border-b border-gray-200 print:border-gray-300">Type</th>
                  <th className="py-2.5 px-3 border-b border-gray-200 print:border-gray-300">Expected</th>
                  <th className="py-2.5 px-3 border-b border-gray-200 print:border-gray-300">Actual</th>
                  <th className="py-2.5 px-3 border-b border-gray-200 print:border-gray-300">Latency</th>
                  <th className="py-2.5 px-3 border-b border-gray-200 print:border-gray-300">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 print:divide-gray-200 font-mono">
                {report.results.map((r, i) => (
                  <tr key={i}>
                    <td className="py-2.5 px-3 font-sans font-medium text-[#333333] print:text-black">
                      {r.testName}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 print:text-gray-700 uppercase text-[10px]">
                      {r.testType}
                    </td>
                    <td className="py-2.5 px-3 text-gray-700 print:text-black">
                      {r.expectedStatus === 408 || r.testType === 'timeout'
                        ? 'TIMEOUT'
                        : r.testType === 'ssrf' || r.expectedStatus === 403
                        ? 'BLOCKED (403)'
                        : `HTTP ${r.expectedStatus}`}
                    </td>
                    <td className="py-2.5 px-3 text-gray-700">
                      {r.actualStatus
                        ? `HTTP ${r.actualStatus}`
                        : r.testType === 'ssrf' || (r.error && r.error.toLowerCase().includes('ssrf'))
                        ? 'BLOCKED'
                        : 'TIMEOUT'}
                    </td>
                    <td className="py-2.5 px-3 text-gray-700 print:text-black">{r.responseTime} ms</td>
                    <td className="py-2.5 px-3 font-sans">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Signoff Footer */}
          <div className="pt-8 border-t border-gray-200 flex items-center justify-between text-xs text-gray-400 print:text-gray-600">
            <div>WebhookGuard Platform • Automated Reliability Certification</div>
            <div>Signoff: QA / DevOps Automated Quality Gate</div>
          </div>
        </div>
      )}
    </div>
  );
};
