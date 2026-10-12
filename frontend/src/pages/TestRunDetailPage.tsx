import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Play,
  RotateCw,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  FileText,
  Copy,
  ExternalLink,
  Zap,
  Repeat,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { api } from '../services/api';
import { TestRun, TestResult, Endpoint, TestSuite } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { StatusBadge, AuthBadge, EnvBadge } from '../components/common/Badge';
import { CodeViewer } from '../components/common/CodeViewer';
import { useToast } from '../context/ToastContext';

export const TestRunDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [run, setRun] = useState<TestRun | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null);
  const [suite, setSuite] = useState<TestSuite | null>(null);
  const [loading, setLoading] = useState(true);
  const [reRunning, setReRunning] = useState(false);

  // Inspector Modal State
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null);

  const toast = useToast();
  const navigate = useNavigate();

  const loadRunDetails = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [runData, resultsData] = await Promise.all([
        api.getTestRun(id),
        api.getTestResults(id),
      ]);
      setRun(runData);
      setResults(resultsData);

      if (runData.endpointId) {
        try {
          const ep = await api.getEndpoint(runData.endpointId);
          setEndpoint(ep);
        } catch {}
      }
      if (runData.suiteId) {
        try {
          const st = await api.getTestSuite(runData.suiteId);
          setSuite(st);
        } catch {}
      }
    } catch (err: any) {
      toast.error('Failed to load run details', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRunDetails();
  }, [id]);

  const handleRerun = async () => {
    if (!run) return;
    try {
      setReRunning(true);
      toast.info('Re-running Test Suite', 'Dispatching live HTTP requests to endpoint...');
      const newRun = await api.triggerTestRun(run.endpointId, run.suiteId, 'manual');
      toast.success(
        'Test Run Complete',
        `Finished run #${newRun.runId.slice(0, 8)} with ${newRun.passed} passed and ${newRun.failed} failed.`
      );
      navigate(`/runs/${newRun.runId}`);
    } catch (err: any) {
      toast.error('Re-run Failed', err.message);
    } finally {
      setReRunning(false);
    }
  };

  if (loading && !run) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <RotateCw className="w-8 h-8 text-brand-500 animate-spin" />
        <div className="text-sm text-slate-400">Loading test run results...</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="glass-panel p-12 text-center rounded-2xl space-y-4">
        <h3 className="text-lg font-bold text-white">Test Run Not Found</h3>
        <p className="text-xs text-slate-400">The requested run identifier does not exist.</p>
        <Link to="/runs">
          <Button size="sm" variant="secondary" icon={<ArrowLeft className="w-4 h-4" />}>
            Back to Runs
          </Button>
        </Link>
      </div>
    );
  }

  const successRate = run.totalTests > 0 ? Math.round((run.passed / run.totalTests) * 1000) / 10 : 0;
  const hasSecurityFailure = results.some((r) => r.status === 'SECURITY FAILURE');

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/runs"
            className="p-2 rounded-lg bg-dark-900 border border-dark-700 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight font-mono">
                Test Run #{run.id.slice(0, 8)}
              </h2>
              <StatusBadge status={run.status} />
              {run.environment && <EnvBadge env={run.environment} />}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {run.endpointName || endpoint?.name || 'Target Webhook'} • {run.suiteName || suite?.name || 'Suite'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link to={`/reports/${run.id}`}>
            <Button size="sm" variant="secondary" icon={<FileText className="w-4 h-4" />}>
              View Full Report
            </Button>
          </Link>

          <Button
            size="sm"
            variant="glow"
            onClick={handleRerun}
            loading={reRunning}
            icon={<Play className="w-3.5 h-3.5" />}
          >
            Re-run Suite
          </Button>
        </div>
      </div>

      {/* Security Alert if invalid HMAC was accepted */}
      {hasSecurityFailure && (
        <div className="p-4 rounded-xl bg-purple-950/40 border border-purple-500/50 flex items-start gap-4 shadow-2xl security-alert-glow">
          <div className="p-2 rounded-lg bg-purple-600/20 text-purple-400 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-purple-200 text-sm flex items-center gap-2">
              <span>SECURITY FAILURE DETECTED</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                CRITICAL VULNERABILITY
              </span>
            </div>
            <p className="text-xs text-purple-300/90 mt-1 leading-relaxed">
              An intentionally forged or invalid HMAC-SHA256 signature was sent to this endpoint, but the endpoint
              accepted the request with HTTP 200 OK instead of rejecting it with HTTP 401 Unauthorized.
            </p>
          </div>
        </div>
      )}

      {/* Run Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl">
          <div className="text-slate-400 text-xs uppercase font-semibold">Total Scenarios</div>
          <div className="text-2xl font-extrabold text-white mt-1 font-mono">{run.totalTests}</div>
          <div className="text-[11px] text-slate-500 mt-1">Automated Assertions</div>
        </div>

        <div className="glass-card p-4 rounded-xl">
          <div className="text-slate-400 text-xs uppercase font-semibold">Passed / Failed</div>
          <div className="text-2xl font-extrabold text-white mt-1 font-mono flex items-center gap-2">
            <span className="text-emerald-400">{run.passed}</span>
            <span className="text-slate-600">/</span>
            <span className={run.failed > 0 ? 'text-rose-400' : 'text-slate-400'}>{run.failed}</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {run.failed === 0 ? 'All tests passed' : `${run.failed} assertion failure(s)`}
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl">
          <div className="text-slate-400 text-xs uppercase font-semibold">Success Rate</div>
          <div className="text-2xl font-extrabold text-white mt-1 font-mono flex items-baseline gap-1">
            <span>{successRate}%</span>
          </div>
          <div className="w-full bg-dark-800 rounded-full h-1 mt-2">
            <div
              className={`h-full rounded-full ${
                successRate > 90 ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl">
          <div className="text-slate-400 text-xs uppercase font-semibold">Total Duration</div>
          <div className="text-2xl font-extrabold text-white mt-1 font-mono flex items-baseline gap-1">
            <span>{run.durationMs ?? 0}</span>
            <span className="text-xs text-slate-400 font-normal">ms</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Completed: {run.completedAt ? new Date(run.completedAt).toLocaleTimeString() : '—'}
          </div>
        </div>
      </div>

      {/* Granular Test Results Table */}
      <div className="glass-card rounded-xl overflow-hidden space-y-3 p-5">
        <div className="flex items-center justify-between pb-3 border-b border-dark-700">
          <div>
            <h3 className="text-base font-semibold text-white">Granular Test Results</h3>
            <p className="text-xs text-slate-400">Click any row to open the deep request/response debugger.</p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {results.length} Scenarios Executed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-dark-700/80 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-3">Test Scenario</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Expected Status</th>
                <th className="py-3 px-3">Actual Status</th>
                <th className="py-3 px-3">Latency</th>
                <th className="py-3 px-3">Retries</th>
                <th className="py-3 px-3">Evaluation</th>
                <th className="py-3 px-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/60 font-mono">
              {results.map((res) => (
                <tr
                  key={res.id}
                  onClick={() => setSelectedResult(res)}
                  className={`cursor-pointer transition-colors ${
                    res.status === 'SECURITY FAILURE'
                      ? 'bg-purple-950/20 hover:bg-purple-950/35 border-l-2 border-l-purple-500'
                      : res.status === 'PASS'
                      ? 'hover:bg-dark-850/60'
                      : 'bg-rose-950/10 hover:bg-rose-950/20'
                  }`}
                >
                  <td className="py-3 px-3 font-sans font-semibold text-slate-200">
                    <div className="flex items-center gap-2">
                      {res.status === 'PASS' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                      {res.status === 'FAIL' && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                      {res.status === 'SECURITY FAILURE' && (
                        <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0 animate-pulse" />
                      )}
                      {res.status === 'TIMEOUT' && <Clock className="w-4 h-4 text-amber-400 shrink-0" />}
                      <span>{res.testName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-slate-400 uppercase text-[11px]">
                    {res.testType}
                  </td>
                  <td className="py-3 px-3 text-slate-300 font-bold">
                    HTTP {res.expectedStatus}
                  </td>
                  <td className="py-3 px-3">
                    {res.actualStatus ? (
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          res.actualStatus === res.expectedStatus
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        HTTP {res.actualStatus}
                      </span>
                    ) : (
                      <span className="text-amber-400 font-bold">TIMEOUT</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    {res.responseTime} ms
                  </td>
                  <td className="py-3 px-3 text-slate-400">
                    {res.retryCount > 0 ? (
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <Repeat className="w-3 h-3" />
                        {res.retryCount}
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="py-3 px-3 font-sans">
                    <StatusBadge status={res.status} />
                  </td>
                  <td className="py-3 px-3 text-right font-sans">
                    <Button size="sm" variant="ghost" className="text-xs py-0.5">
                      Debug
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep Inspection Modal */}
      <Modal
        isOpen={!!selectedResult}
        onClose={() => setSelectedResult(null)}
        maxWidth="4xl"
        title={
          <div className="flex items-center gap-3">
            <span>Test Debugger: {selectedResult?.testName}</span>
            {selectedResult && <StatusBadge status={selectedResult.status} />}
          </div>
        }
        subtitle="Detailed request payload, cryptographic signature header, response body, and timing telemetry."
      >
        {selectedResult && (
          <div className="space-y-6 text-xs">
            {/* Security Alert Details */}
            {selectedResult.status === 'SECURITY FAILURE' && selectedResult.securityDetails && (
              <div className="p-4 rounded-xl bg-purple-950/50 border border-purple-500/60 space-y-2">
                <div className="flex items-center gap-2 text-purple-200 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5 text-purple-400 animate-bounce" />
                  <span>Vulnerability Analysis: Invalid Signature Accepted</span>
                </div>
                <div className="text-slate-300 leading-relaxed">
                  {selectedResult.securityDetails.issue}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-[11px] font-mono">
                  <div className="bg-dark-900 p-2.5 rounded-lg border border-purple-500/20">
                    <div className="text-purple-400 font-semibold mb-0.5">Expected Behavior:</div>
                    <div className="text-slate-300">{selectedResult.securityDetails.expectedBehavior}</div>
                  </div>
                  <div className="bg-dark-900 p-2.5 rounded-lg border border-purple-500/20">
                    <div className="text-rose-400 font-semibold mb-0.5">Observed Behavior:</div>
                    <div className="text-slate-300">{selectedResult.securityDetails.observedBehavior}</div>
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-900/30 border border-purple-500/30 text-[11px]">
                  <span className="font-bold text-purple-300">Remediation: </span>
                  <span className="text-slate-200">{selectedResult.securityDetails.remediation}</span>
                </div>
              </div>
            )}

            {/* Status & Timing Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-dark-950 p-4 rounded-xl border border-dark-800 font-mono">
              <div>
                <div className="text-slate-500 text-[10px] uppercase">Expected Status</div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5">
                  HTTP {selectedResult.expectedStatus}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-[10px] uppercase">Actual Status</div>
                <div
                  className={`text-sm font-bold mt-0.5 ${
                    selectedResult.actualStatus === selectedResult.expectedStatus
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {selectedResult.actualStatus ? `HTTP ${selectedResult.actualStatus}` : 'TIMEOUT'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-[10px] uppercase">Response Latency</div>
                <div className="text-sm font-bold text-cyan-400 mt-0.5">
                  {selectedResult.responseTime} ms
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-[10px] uppercase">Retries Executed</div>
                <div className="text-sm font-bold text-amber-400 mt-0.5">
                  {selectedResult.retryCount} attempt(s)
                </div>
              </div>
            </div>

            {/* Retry Timeline if attempts exist */}
            {selectedResult.attempts && selectedResult.attempts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Repeat className="w-4 h-4 text-amber-400" />
                  <span>Retry Attempt Timeline</span>
                </h4>
                <div className="space-y-1.5 font-mono text-xs">
                  {selectedResult.attempts.map((att) => (
                    <div
                      key={att.attemptNumber}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-dark-900 border border-dark-800"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-300">Attempt {att.attemptNumber}:</span>
                        <StatusBadge status={att.status} />
                        {att.statusCode && (
                          <span className="text-slate-400">Status: HTTP {att.statusCode}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                        <span>{att.responseTimeMs} ms</span>
                        <span>{new Date(att.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outgoing Request View */}
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-200">Outgoing Request</h4>
              <div className="p-3 rounded-lg bg-dark-950 border border-dark-800 space-y-2 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 font-bold">
                    {selectedResult.request.method}
                  </span>
                  <span className="text-slate-200 truncate">{selectedResult.request.url}</span>
                </div>
              </div>
            </div>

            {/* Headers Viewer */}
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-200">Request Headers</h4>
              <CodeViewer
                code={selectedResult.request.headers}
                title="Headers (Masked Secrets)"
                maxHeight="max-h-40"
              />
            </div>

            {/* Request Payload */}
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-200">Request Payload Body</h4>
              <CodeViewer
                code={selectedResult.request.body ?? '(Empty Body)'}
                title="Payload"
                maxHeight="max-h-48"
              />
            </div>

            {/* Response Body */}
            <div className="space-y-2">
              <h4 className="font-semibold text-slate-200">Response Body</h4>
              {selectedResult.response?.body ? (
                <CodeViewer
                  code={selectedResult.response.body}
                  title={`Response Body (HTTP ${selectedResult.response.status})`}
                  maxHeight="max-h-56"
                />
              ) : (
                <div className="p-4 rounded-xl bg-dark-950 border border-dark-800 text-slate-500 font-mono">
                  {selectedResult.error || 'No response body received (Connection Timed Out or Error)'}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
