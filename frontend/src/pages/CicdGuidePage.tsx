import React, { useState, useEffect, useRef } from 'react';
import {
  GitBranch,
  Terminal,
  Play,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { api, API_BASE } from '../services/api';
import { Endpoint, TestSuite } from '../types';
import { Button } from '../components/common/Button';
import { CodeViewer } from '../components/common/CodeViewer';
import { useToast } from '../context/ToastContext';

type GitHubRunState =
  | 'idle'
  | 'Submitting'
  | 'Queued'
  | 'In progress'
  | 'Passed'
  | 'Failed'
  | 'Infrastructure error';

export const CicdGuidePage: React.FC = () => {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [selectedSuiteId, setSelectedSuiteId] = useState('');
  const [failOnErrors, setFailOnErrors] = useState(true);

  // Direct Simulation State
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  // Real GitHub Actions State
  const [ghState, setGhState] = useState<GitHubRunState>('idle');
  const [ghRunInfo, setGhRunInfo] = useState<{
    runId?: number;
    htmlUrl?: string;
    message?: string;
    error?: string;
    dispatchedAt?: string;
    suiteName?: string;
    durationMs?: number;
    runNumber?: number;
  } | null>(null);

  const pollTimerRef = useRef<any>(null);
  const isPollingRef = useRef<boolean>(false);
  const toast = useToast();

  useEffect(() => {
    Promise.all([api.getEndpoints(), api.getTestSuites()]).then(([eps, suList]) => {
      setEndpoints(eps);
      setSuites(suList);
      if (eps.length > 0) setSelectedEndpointId(eps[0].id);
      if (suList.length > 0) {
        setSelectedSuiteId(suList[0].id);
        if (suList[0].endpointId) {
          setSelectedEndpointId(suList[0].endpointId);
        }
      }
    });

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const handleSuiteChange = (suiteId: string) => {
    setSelectedSuiteId(suiteId);
    const suite = suites.find((s) => s.id === suiteId);
    if (suite && suite.endpointId) {
      setSelectedEndpointId(suite.endpointId);
    }
  };

  // 1. Direct WebhookGuard API Gate Simulation
  const handleSimulateApiGate = async () => {
    if (!selectedEndpointId || !selectedSuiteId) {
      toast.error('Select an endpoint and suite first');
      return;
    }

    try {
      setSimulating(true);
      setSimResult(null);
      const res = await api.triggerTestRun(selectedEndpointId, selectedSuiteId, 'cicd', failOnErrors);
      setSimResult({
        httpStatus: 201,
        statusText: 'Created (Pipeline Success: Passed Gate)',
        data: res,
      });
      toast.success('CI/CD Quality Gate Passed', 'All webhook assertions succeeded with HTTP 201.');
    } catch (err: any) {
      setSimResult({
        httpStatus: 422,
        statusText: 'Unprocessable Entity (Pipeline Blocked: Failed Gate)',
        error: err.message,
      });
      toast.error('CI/CD Gate Blocked Deployment', err.message);
    } finally {
      setSimulating(false);
    }
  };

  // 2. Real GitHub Actions Workflow Dispatch & Polling
  const handleRunGitHubActions = async () => {
    if (!selectedSuiteId) {
      toast.error('Please select a test suite first');
      return;
    }

    const suite = suites.find((s) => s.id === selectedSuiteId);
    const targetEndpointId = selectedEndpointId || suite?.endpointId;

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    try {
      setGhState('Submitting');
      setGhRunInfo({
        suiteName: suite?.name || 'Selected Suite',
        message: 'Dispatching workflow_dispatch event to GitHub Actions...',
      });

      const dispatchRes = await api.dispatchGitHubAction(selectedSuiteId, targetEndpointId);
      const dispatchTime = dispatchRes.dispatchedAt || new Date().toISOString();

      setGhState('Queued');
      setGhRunInfo((prev) => ({
        ...prev,
        dispatchedAt: dispatchTime,
        message: 'Workflow dispatch accepted by GitHub. Waiting for run initialization...',
      }));

      toast.info('Workflow Dispatched', 'GitHub accepted workflow dispatch. Polling run status...');

      // Begin Polling
      isPollingRef.current = true;
      let attempts = 0;
      const maxAttempts = 60; // 60 * 3s = 3 minutes maximum timeout
      let activeRunId: number | undefined = undefined;

      pollTimerRef.current = setInterval(async () => {
        if (!isPollingRef.current) return;
        attempts++;

        try {
          const statusRes = await api.getGitHubActionStatus({
            suiteId: selectedSuiteId,
            runId: activeRunId,
            since: dispatchTime,
          });

          if (statusRes.found && statusRes.run) {
            const run = statusRes.run;
            activeRunId = run.id;

            setGhRunInfo((prev) => ({
              ...prev,
              runId: run.id,
              htmlUrl: run.htmlUrl,
              runNumber: run.runNumber,
            }));

            if (run.status === 'queued') {
              setGhState('Queued');
              setGhRunInfo((prev) => ({
                ...prev,
                message: `Run #${run.runNumber} is queued in GitHub Actions runner pool...`,
              }));
            } else if (run.status === 'in_progress') {
              setGhState('In progress');
              setGhRunInfo((prev) => ({
                ...prev,
                message: `Run #${run.runNumber} is actively executing webhook assertions...`,
              }));
            } else if (run.status === 'completed') {
              // Concluded! Stop polling
              isPollingRef.current = false;
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);

              if (run.conclusion === 'success') {
                setGhState('Passed');
                setGhRunInfo((prev) => ({
                  ...prev,
                  message: `Run #${run.runNumber} completed successfully. 100% of webhook test scenarios passed.`,
                }));
                toast.success('GitHub Actions Quality Gate Passed', `Run #${run.runNumber} succeeded with zero errors.`);
              } else if (run.conclusion === 'failure') {
                setGhState('Failed');
                setGhRunInfo((prev) => ({
                  ...prev,
                  message: `Run #${run.runNumber} failed assertions (HTTP 422). Pipeline blocked deployment.`,
                }));
                toast.error('GitHub Actions Quality Gate Blocked', `Run #${run.runNumber} failed assertions.`);
              } else {
                setGhState('Infrastructure error');
                setGhRunInfo((prev) => ({
                  ...prev,
                  message: `Run #${run.runNumber} ended with status: ${run.conclusion || 'unknown'}.`,
                }));
              }
            }
          }

          if (attempts >= maxAttempts && isPollingRef.current) {
            isPollingRef.current = false;
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            setGhState('Infrastructure error');
            setGhRunInfo((prev) => ({
              ...prev,
              error: 'Polling timeout exceeded (3 minutes). Check run status directly on GitHub Actions.',
            }));
            toast.error('Polling Timeout', 'Workflow execution timed out waiting for completion.');
          }
        } catch (pollErr: any) {
          console.warn('Polling error:', pollErr);
        }
      }, 3000);
    } catch (err: any) {
      setGhState('Infrastructure error');
      setGhRunInfo({
        error: err.message || 'Failed to dispatch GitHub Actions workflow',
      });
      toast.error('GitHub Actions Trigger Failed', err.message);
    }
  };

  const isActionBusy = simulating || ghState === 'Submitting' || ghState === 'Queued' || ghState === 'In progress';

  const sampleGitHubAction = `name: WebhookGuard Manual Quality Gate

on:
  workflow_dispatch:
    inputs:
      suite_id:
        description: 'Test Suite ID to execute'
        required: true
        type: string
      endpoint_id:
        description: 'Target Endpoint ID (optional, resolved automatically if omitted)'
        required: false
        type: string

permissions:
  contents: read

jobs:
  manual-quality-gate:
    name: WebhookGuard Quality Gate Execution
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - name: Execute WebhookGuard Quality Gate
        env:
          BASE_URL: https://y09oz1azlf.execute-api.ap-south-1.amazonaws.com
          ENDPOINT_ID: \${{ github.event.inputs.endpoint_id }}
          SUITE_ID: \${{ github.event.inputs.suite_id }}
          API_KEY: \${{ secrets.WEBHOOKGUARD_API_KEY }}
        run: |
          RESPONSE=\$(curl -s -S --max-time 60 -w "\\n%{http_code}" -X POST \\
            "\$BASE_URL/api/test-runs?failOnErrors=true" \\
            -H "Content-Type: application/json" \\
            -H "X-API-Key: \$API_KEY" \\
            -d "{\\"endpointId\\": \\"\$ENDPOINT_ID\\", \\"suiteId\\": \\"\$SUITE_ID\\", \\"trigger\\": \\"workflow_dispatch\\"}")

          HTTP_STATUS=\$(echo "\$RESPONSE" | tail -n1)
          if [ "\$HTTP_STATUS" != "201" ]; then
            echo "::error::WebhookGuard Quality Gate Blocked Pipeline (HTTP \$HTTP_STATUS)"
            exit 1
          fi`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono bg-blue-50 text-blue-700 border border-blue-200 mb-2">
          <GitBranch className="w-3.5 h-3.5" />
          <span>Automated Quality Gate Integration</span>
        </div>
        <h2 className="text-xl font-bold text-[#333333] tracking-tight">CI/CD Pipeline Quality Gate</h2>
        <p className="text-xs text-gray-500 mt-0.5 max-w-2xl leading-relaxed">
          Incorporate automated webhook testing directly into your deployment pipelines. You can simulate
          the quality gate call directly via API or trigger a <strong>real GitHub Actions workflow</strong> on the
          remote repository to inspect actual runner execution.
        </p>
      </div>

      {/* Interactive Controls Card */}
      <div className="bg-white border border-gray-200 p-6 rounded-lg space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-bold text-[#333333]">Pipeline Quality Gate Controller</h3>
          </div>
          <span className="text-xs font-mono text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-200 self-start sm:self-auto">
            POST /api/test-runs?failOnErrors=true
          </span>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          Select a test suite to validate. Click <strong>Simulate API Gate</strong> for immediate in-browser API evaluation,
          or click <strong>Run GitHub Actions</strong> to trigger a live <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-800">workflow_dispatch</code> on{' '}
          <a
            href="https://github.com/santhosh11225/webhookguard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
          >
            santhosh11225/webhookguard <ExternalLink className="w-3 h-3" />
          </a>.
        </p>

        {/* Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-semibold text-[#333333] mb-1">
              Test Suite <span className="text-blue-600 font-normal">(Auto-maps endpoint)</span>
            </label>
            <select
              value={selectedSuiteId}
              onChange={(e) => handleSuiteChange(e.target.value)}
              disabled={isActionBusy}
              className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-[#333333] focus:outline-none focus:border-blue-600 disabled:bg-gray-50"
            >
              {suites.map((su) => (
                <option key={su.id} value={su.id}>
                  {su.name} ({su.tests.length} tests)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#333333] mb-1">Target Endpoint</label>
            <select
              value={selectedEndpointId}
              onChange={(e) => setSelectedEndpointId(e.target.value)}
              disabled={isActionBusy}
              className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-[#333333] focus:outline-none focus:border-blue-600 disabled:bg-gray-50"
            >
              {endpoints.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.name} ({ep.authentication.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleSimulateApiGate}
            loading={simulating}
            disabled={isActionBusy}
            icon={<Play className="w-4 h-4 text-blue-600" />}
            className="flex-1"
          >
            Simulate API Gate
          </Button>

          <Button
            variant="primary"
            onClick={handleRunGitHubActions}
            loading={ghState === 'Submitting' || ghState === 'Queued' || ghState === 'In progress'}
            disabled={isActionBusy}
            icon={<Sparkles className="w-4 h-4 text-white" />}
            className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
          >
            Run GitHub Actions
          </Button>
        </div>

        {/* Real GitHub Actions Real-Time Status Card */}
        {ghState !== 'idle' && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3 font-mono text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50 p-3.5 rounded border border-gray-200">
              <div className="flex items-center gap-2.5">
                {ghState === 'Submitting' && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                {ghState === 'Queued' && <Clock className="w-4 h-4 text-amber-600 animate-pulse" />}
                {ghState === 'In progress' && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                {ghState === 'Passed' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                {ghState === 'Failed' && <XCircle className="w-4 h-4 text-red-600" />}
                {ghState === 'Infrastructure error' && <AlertTriangle className="w-4 h-4 text-red-600" />}

                <div>
                  <span className="text-gray-500 font-bold mr-2">GitHub Run State:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold uppercase text-[11px] ${
                      ghState === 'Passed'
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : ghState === 'Failed'
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : ghState === 'Infrastructure error'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {ghState}
                  </span>
                </div>
              </div>

              {ghRunInfo?.htmlUrl && (
                <a
                  href={ghRunInfo.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-gray-100 text-blue-700 border border-blue-300 rounded font-sans text-xs font-semibold shadow-sm transition-colors"
                >
                  <span>View Run #{ghRunInfo.runNumber || ghRunInfo.runId}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            {/* Status Narrative */}
            <div className="p-3 bg-white rounded border border-gray-200 text-gray-700 text-xs font-sans space-y-1">
              <div className="font-semibold text-gray-900 flex items-center justify-between">
                <span>Suite: {ghRunInfo?.suiteName || 'Selected Suite'}</span>
                {ghRunInfo?.runId && <span className="font-mono text-gray-500 text-xs">ID: {ghRunInfo.runId}</span>}
              </div>
              <p className="text-gray-600 text-xs">{ghRunInfo?.message || ghRunInfo?.error}</p>
              {ghRunInfo?.error && (
                <p className="text-xs text-red-600 font-mono bg-red-50 p-2 rounded border border-red-200 mt-1">
                  {ghRunInfo.error}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Live Simulation Output Card */}
        {simResult && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3 font-mono text-xs">
            <div className="flex items-center gap-3">
              <span className="text-gray-500 font-bold">API Return Status:</span>
              <span
                className={`px-2.5 py-0.5 rounded font-bold ${
                  simResult.httpStatus === 201
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                HTTP {simResult.httpStatus} {simResult.statusText}
              </span>
            </div>

            <CodeViewer
              code={simResult.data || { error: simResult.error }}
              title="Simulator Response Payload"
              maxHeight="max-h-64"
            />
          </div>
        )}
      </div>

      {/* GitHub Actions YAML Workflow */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#333333]">GitHub Actions Workflow Template</h3>
            <p className="text-xs text-gray-500">
              Workflow file at <span className="font-mono text-gray-700">.github/workflows/webhookguard-manual-quality-gate.yml</span> enabled
              for dispatch via the controller above.
            </p>
          </div>
        </div>

        <CodeViewer
          code={sampleGitHubAction}
          language="yaml"
          title=".github/workflows/webhookguard-manual-quality-gate.yml"
        />
      </div>

      {/* cURL Examples */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 p-5 rounded-lg space-y-3">
          <h4 className="text-sm font-semibold text-[#333333]">Trigger Quality Gate via cURL</h4>
          <CodeViewer
            code={`curl -X POST ${API_BASE}/test-runs?failOnErrors=true \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_ADMIN_KEY" \\
  -d '{
    "endpointId": "${selectedEndpointId || 'endpoint_id'}",
    "suiteId": "${selectedSuiteId || 'suite_id'}",
    "trigger": "cicd"
  }'`}
            language="bash"
            maxHeight="max-h-36"
          />
        </div>

        <div className="bg-white border border-gray-200 p-5 rounded-lg space-y-3">
          <h4 className="text-sm font-semibold text-[#333333]">Dispatch GitHub Actions via API</h4>
          <CodeViewer
            code={`curl -X POST ${API_BASE}/cicd/dispatch \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_ADMIN_KEY" \\
  -d '{
    "suiteId": "${selectedSuiteId || 'suite_id'}"
  }'`}
            language="bash"
            maxHeight="max-h-36"
          />
        </div>
      </div>
    </div>
  );
};
