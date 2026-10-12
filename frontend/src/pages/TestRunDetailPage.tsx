import React, { useState, useEffect, useCallback } from 'react';
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
  Repeat,
} from 'lucide-react';
import { api } from '../services/api';
import { TestRun, TestResult, Endpoint, TestSuite } from '../types';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { StatusBadge, EnvBadge } from '../components/common/Badge';
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

  const loadRunDetails = useCallback(async () => {
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
  }, [id, toast]);

  useEffect(() => {
    loadRunDetails();
  }, [loadRunDetails]);

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
        <RotateCw className="w-8 h-8 text-blue-600 animate-spin" />
        <div className="text-sm text-gray-500">Loading test run results...</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="bg-white border border-gray-200 p-12 text-center rounded-lg space-y-4">
        <h3 className="text-lg font-bold text-[#333333]">Test Run Not Found</h3>
        <p className="text-xs text-gray-500">The requested run identifier does not exist.</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link
            to="/runs"
            className="p-2 rounded bg-white border border-gray-200 text-gray-500 hover:text-[#333333] hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-[#333333] tracking-tight font-mono">
                Test Run #{run.id.slice(0, 8)}
              </h2>
              <StatusBadge status={run.status} />
              {run.environment && <EnvBadge env={run.environment} />}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {run.endpointName || endpoint?.name || 'Target Webhook'} • {run.suiteName || suite?.name || 'Suite'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link to={`/reports/${run.id}`}>
            <Button size="sm" variant="secondary" icon={<FileText className="w-4 h-4" />}>
              View Full Report
            </Button>
          </Link>

          <Button
            size="sm"
            variant="primary"
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
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-4">
          <div className="p-2 rounded bg-red-100 text-red-600 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="font-bold text-red-700 text-sm flex items-center gap-2">
              <span>SECURITY FAILURE DETECTED</span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                CRITICAL VULNERABILITY
              </span>
            </div>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">
              An intentionally forged or invalid HMAC-SHA256 signature was sent to this endpoint, but the endpoint
              accepted the request with HTTP 200 OK instead of rejecting it with HTTP 401 Unauthorized.
            </p>
          </div>
        </div>
      )}

      {/* Run Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 p-4 rounded-lg">
          <div className="text-gray-500 text-xs uppercase font-semibold">Total Scenarios</div>
          <div className="text-2xl font-extrabold text-[#333333] mt-1 font-mono">{run.totalTests}</div>
          <div className="text-[11px] text-gray-400 mt-1">Automated Assertions</div>
        </div>

        <div className="bg-white border border-gray-200 p-4 rounded-lg">
          <div className="text-gray-500 text-xs uppercase font-semibold">Passed / Failed</div>
          <div className="text-2xl font-extrabold text-[#333333] mt-1 font-mono flex items-center gap-2">
            <span className="text-green-700">{run.passed}</span>
            <span className="text-gray-400">/</span>
            <span className={run.failed > 0 ? 'text-red-700' : 'text-gray-500'}>{run.failed}</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            {run.failed === 0 ? 'All tests passed' : `${run.failed} assertion failure(s)`}
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4 rounded-lg">
          <div className="text-gray-500 text-xs uppercase font-semibold">Success Rate</div>
          <div className="text-2xl font-extrabold text-[#333333] mt-1 font-mono flex items-baseline gap-1">
            <span>{successRate}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
            <div
              className={`h-full rounded-full ${
                successRate > 90 ? 'bg-green-600' : 'bg-red-600'
              }`}
              style={{ width: `${successRate}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-gray-200 p-4 rounded-lg">
          <div className="text-gray-500 text-xs uppercase font-semibold">Total Duration</div>
          <div className="text-2xl font-extrabold text-[#333333] mt-1 font-mono flex items-baseline gap-1">
            <span>{run.durationMs ?? 0}</span>
            <span className="text-xs text-gray-500 font-normal">ms</span>
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Completed: {run.completedAt ? new Date(run.completedAt).toLocaleTimeString() : '—'}
          </div>
        </div>
      </div>

      {/* Granular Test Results Table */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <div>
            <h3 className="text-sm font-semibold text-[#333333]">Granular Test Results</h3>
            <p className="text-xs text-gray-500">Click any row to open the deep request/response debugger.</p>
          </div>
          <span className="text-xs font-mono text-gray-500">
            {results.length} Scenarios Executed
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Test Scenario</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Expected Status</th>
                <th className="py-2.5 px-3">Actual Status</th>
                <th className="py-2.5 px-3">Latency</th>
                <th className="py-2.5 px-3">Retries</th>
                <th className="py-2.5 px-3">Evaluation</th>
                <th className="py-2.5 px-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {results.map((res) => (
                <tr
                  key={res.id}
                  onClick={() => setSelectedResult(res)}
                  className={`cursor-pointer transition-colors ${
                    res.status === 'SECURITY FAILURE'
                      ? 'bg-red-50 hover:bg-red-100/70 border-l-2 border-l-red-600'
                      : res.status === 'PASS'
                      ? 'hover:bg-gray-50'
                      : 'bg-red-50/60 hover:bg-red-100/70'
                  }`}
                >
                  <td className="py-2.5 px-3 font-sans font-semibold text-[#333333]">
                    <div className="flex items-center gap-2">
                      {res.status === 'PASS' && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                      {res.status === 'FAIL' && <XCircle className="w-4 h-4 text-red-600 shrink-0" />}
                      {res.status === 'SECURITY FAILURE' && (
                        <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                      )}
                      {res.status === 'TIMEOUT' && <Clock className="w-4 h-4 text-amber-600 shrink-0" />}
                      <span>{res.testName}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-gray-500 uppercase text-[11px]">
                    {res.testType}
                  </td>
                  <td className="py-2.5 px-3 text-gray-700 font-bold">
                    {res.expectedStatus === 408 || res.testType === 'timeout'
                      ? 'TIMEOUT'
                      : res.testType === 'ssrf' || res.expectedStatus === 403
                      ? 'BLOCKED (403)'
                      : `HTTP ${res.expectedStatus}`}
                  </td>
                  <td className="py-2.5 px-3">
                    {res.actualStatus ? (
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          res.actualStatus === res.expectedStatus
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        HTTP {res.actualStatus}
                      </span>
                    ) : res.testType === 'ssrf' || (res.error && res.error.toLowerCase().includes('ssrf')) ? (
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          res.status === 'PASS'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                        }`}
                      >
                        BLOCKED
                      </span>
                    ) : (
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          res.status === 'PASS'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        TIMEOUT
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-gray-700">
                    {res.responseTime} ms
                  </td>
                  <td className="py-2.5 px-3 text-gray-500">
                    {res.retryCount > 0 ? (
                      <span className="text-amber-700 font-semibold flex items-center gap-1">
                        <Repeat className="w-3 h-3" />
                        {res.retryCount}
                      </span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-sans">
                    <StatusBadge status={res.status} />
                  </td>
                  <td className="py-2.5 px-3 text-right font-sans">
                    <Button size="sm" variant="ghost" className="text-xs py-0.5 text-gray-600 hover:text-[#333333]">
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
          <div className="space-y-6 text-xs text-[#333333]">
            {/* Security Alert Details */}
            {selectedResult.status === 'SECURITY FAILURE' && selectedResult.securityDetails && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 space-y-2">
                <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  <span>Vulnerability Analysis: Invalid Signature Accepted</span>
                </div>
                <div className="text-red-700 leading-relaxed">
                  {selectedResult.securityDetails.issue}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-[11px] font-mono">
                  <div className="bg-white p-2.5 rounded border border-red-200">
                    <div className="text-red-700 font-semibold mb-0.5">Expected Behavior:</div>
                    <div className="text-gray-700">{selectedResult.securityDetails.expectedBehavior}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-red-200">
                    <div className="text-red-700 font-semibold mb-0.5">Observed Behavior:</div>
                    <div className="text-gray-700">{selectedResult.securityDetails.observedBehavior}</div>
                  </div>
                </div>
                <div className="p-2.5 rounded bg-red-100/50 border border-red-200 text-[11px]">
                  <span className="font-bold text-red-800">Remediation: </span>
                  <span className="text-red-700">{selectedResult.securityDetails.remediation}</span>
                </div>
              </div>
            )}

            {/* Status & Timing Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200 font-mono">
              <div>
                <div className="text-gray-500 text-[10px] uppercase">Expected Status</div>
                <div className="text-sm font-bold text-green-700 mt-0.5">
                  {selectedResult.expectedStatus === 408 || selectedResult.testType === 'timeout'
                    ? 'TIMEOUT'
                    : selectedResult.testType === 'ssrf' || selectedResult.expectedStatus === 403
                    ? 'BLOCKED (403)'
                    : `HTTP ${selectedResult.expectedStatus}`}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-[10px] uppercase">Actual Status</div>
                <div
                  className={`text-sm font-bold mt-0.5 ${
                    selectedResult.status === 'PASS' || selectedResult.actualStatus === selectedResult.expectedStatus
                      ? 'text-green-700'
                      : 'text-red-700'
                  }`}
                >
                  {selectedResult.actualStatus
                    ? `HTTP ${selectedResult.actualStatus}`
                    : selectedResult.testType === 'ssrf' ||
                      (selectedResult.error && selectedResult.error.toLowerCase().includes('ssrf'))
                    ? 'BLOCKED'
                    : 'TIMEOUT'}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-[10px] uppercase">Response Latency</div>
                <div className="text-sm font-bold text-blue-600 mt-0.5">
                  {selectedResult.responseTime} ms
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-[10px] uppercase">Retries Executed</div>
                <div className="text-sm font-bold text-amber-700 mt-0.5">
                  {selectedResult.retryCount} attempt(s)
                </div>
              </div>
            </div>

            {/* Retry Timeline if attempts exist */}
            {selectedResult.attempts && selectedResult.attempts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-[#333333] flex items-center gap-1.5">
                  <Repeat className="w-4 h-4 text-amber-600" />
                  <span>Retry Attempt Timeline</span>
                </h4>
                <div className="space-y-1.5 font-mono text-xs">
                  {selectedResult.attempts.map((att) => (
                    <div
                      key={att.attemptNumber}
                      className="flex items-center justify-between p-2.5 rounded bg-white border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-[#333333]">Attempt {att.attemptNumber}:</span>
                        <StatusBadge status={att.status} />
                        {att.statusCode && (
                          <span className="text-gray-600">Status: HTTP {att.statusCode}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-gray-500 text-[11px]">
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
              <h4 className="font-semibold text-[#333333]">Outgoing Request</h4>
              <div className="p-3 rounded bg-gray-50 border border-gray-200 space-y-2 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                    {selectedResult.request.method}
                  </span>
                  <span className="text-[#333333] truncate">{selectedResult.request.url}</span>
                </div>
              </div>
            </div>

            {/* Headers Viewer */}
            <div className="space-y-2">
              <h4 className="font-semibold text-[#333333]">Request Headers</h4>
              <CodeViewer
                code={selectedResult.request.headers}
                title="Headers (Masked Secrets)"
                maxHeight="max-h-40"
              />
            </div>

            {/* Request Payload */}
            <div className="space-y-2">
              <h4 className="font-semibold text-[#333333]">Request Payload Body</h4>
              <CodeViewer
                code={selectedResult.request.body ?? '(Empty Body)'}
                title="Payload"
                maxHeight="max-h-48"
              />
            </div>

            {/* Response Body */}
            <div className="space-y-2">
              <h4 className="font-semibold text-[#333333]">Response Body</h4>
              {selectedResult.response?.body ? (
                <CodeViewer
                  code={selectedResult.response.body}
                  title={`Response Body (HTTP ${selectedResult.response.status})`}
                  maxHeight="max-h-56"
                />
              ) : (
                <div className="p-4 rounded bg-gray-50 border border-gray-200 text-gray-500 font-mono">
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
