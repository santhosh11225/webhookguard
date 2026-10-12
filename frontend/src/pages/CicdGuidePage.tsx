import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Terminal,
  Copy,
  Check,
  Play,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ArrowRight,
  Code,
} from 'lucide-react';
import { api } from '../services/api';
import { Endpoint, TestSuite } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { CodeViewer } from '../components/common/CodeViewer';
import { StatusBadge } from '../components/common/Badge';
import { useToast } from '../context/ToastContext';

export const CicdGuidePage: React.FC = () => {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [selectedEndpointId, setSelectedEndpointId] = useState('');
  const [selectedSuiteId, setSelectedSuiteId] = useState('');
  const [failOnErrors, setFailOnErrors] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const toast = useToast();

  useEffect(() => {
    Promise.all([api.getEndpoints(), api.getTestSuites()]).then(([eps, suList]) => {
      setEndpoints(eps);
      setSuites(suList);
      if (eps.length > 0) setSelectedEndpointId(eps[0].id);
      if (suList.length > 0) setSelectedSuiteId(suList[0].id);
    });
  }, []);

  const handleTriggerCi = async () => {
    if (!selectedEndpointId || !selectedSuiteId) {
      toast.error('Select an endpoint and suite first');
      return;
    }

    try {
      setTesting(true);
      setTestResult(null);
      const res = await api.triggerTestRun(selectedEndpointId, selectedSuiteId, 'cicd', failOnErrors);
      setTestResult({
        httpStatus: 201,
        statusText: 'Created (Pipeline Success: Passed Gate)',
        data: res,
      });
      toast.success('CI/CD Quality Gate Passed', 'All webhook assertions succeeded with HTTP 201.');
    } catch (err: any) {
      setTestResult({
        httpStatus: 422,
        statusText: 'Unprocessable Entity (Pipeline Blocked: Failed Gate)',
        error: err.message,
      });
      toast.error('CI/CD Gate Blocked Deployment', err.message);
    } finally {
      setTesting(false);
    }
  };

  const sampleGitHubAction = `name: WebhookGuard Quality Gate

on:
  push:
    branches: [ main, staging ]
  pull_request:
    branches: [ main ]

jobs:
  validate-webhooks:
    name: Verify Webhook Handlers
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Codebase
        uses: actions/checkout@v4

      - name: Trigger WebhookGuard Test Suite
        id: webhook_gate
        run: |
          echo "Executing automated webhook validation..."
          RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \\
            "http://localhost:4000/api/test-runs?failOnErrors=true" \\
            -H "Content-Type: application/json" \\
            -d '{
              "endpointId": "${selectedEndpointId || 'YOUR_ENDPOINT_ID'}",
              "suiteId": "${selectedSuiteId || 'YOUR_SUITE_ID'}",
              "trigger": "cicd"
            }')

          HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
          BODY=$(echo "$RESPONSE" | sed '$d')

          echo "Response Body:"
          echo "$BODY"

          if [ "$HTTP_STATUS" -ne 201 ]; then
            echo "::error::WebhookGuard Quality Gate Failed with HTTP $HTTP_STATUS"
            exit 1
          fi

          echo "Webhook tests passed successfully!"`;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-brand-500/10 text-brand-300 border border-brand-500/30 mb-2">
          <GitBranch className="w-3.5 h-3.5" />
          <span>Automated Quality Gate Integration</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">CI/CD Pipeline API</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
          Incorporate automated webhook testing directly into your deployment pipelines. WebhookGuard
          provides CI/CD-ready REST APIs that return non-zero exit codes (HTTP 422) when any webhook test
          or security assertion fails.
        </p>
      </div>

      {/* Interactive API Tester */}
      <div className="glass-card p-6 rounded-2xl space-y-4 border-l-4 border-l-brand-500">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-brand-400" />
            <h3 className="text-base font-bold text-white">Interactive CI/CD Gate Simulator</h3>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            POST /api/test-runs?failOnErrors=true
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Simulate calling WebhookGuard from a CI runner. When <span className="text-slate-200 font-mono">failOnErrors=true</span> is active,
          a failing test returns HTTP 422 to automatically fail your build or pull request!
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target Endpoint</label>
            <select
              value={selectedEndpointId}
              onChange={(e) => setSelectedEndpointId(e.target.value)}
              className="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            >
              {endpoints.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Test Suite</label>
            <select
              value={selectedSuiteId}
              onChange={(e) => setSelectedSuiteId(e.target.value)}
              className="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            >
              {suites.map((su) => (
                <option key={su.id} value={su.id}>
                  {su.name} ({su.tests.length} tests)
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <Button
              variant="glow"
              onClick={handleTriggerCi}
              loading={testing}
              icon={<Play className="w-4 h-4" />}
            >
              Simulate CI/CD Pipeline Call
            </Button>
          </div>
        </div>

        {/* Live Simulation Response Output */}
        {testResult && (
          <div className="mt-4 pt-4 border-t border-dark-700/60 space-y-3 font-mono text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-bold">API Return Status:</span>
              <span
                className={`px-2.5 py-0.5 rounded font-bold ${
                  testResult.httpStatus === 201
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}
              >
                HTTP {testResult.httpStatus} {testResult.statusText}
              </span>
            </div>

            <CodeViewer
              code={testResult.data || { error: testResult.error }}
              title="CI Runner Response Payload"
              maxHeight="max-h-64"
            />
          </div>
        )}
      </div>

      {/* GitHub Actions YAML Workflow */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">GitHub Actions Workflow Template</h3>
            <p className="text-xs text-slate-400">
              Drop this file into <span className="font-mono text-slate-300">.github/workflows/webhook-test.yml</span> to
              validate webhook changes on every commit.
            </p>
          </div>
        </div>

        <CodeViewer code={sampleGitHubAction} language="yaml" title=".github/workflows/webhook-test.yml" />
      </div>

      {/* cURL Examples */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-xl space-y-3">
          <h4 className="text-sm font-semibold text-slate-200">Trigger Test Suite via cURL</h4>
          <CodeViewer
            code={`curl -X POST http://localhost:4000/api/test-runs \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpointId": "${selectedEndpointId || 'endpoint_id'}",
    "suiteId": "${selectedSuiteId || 'suite_id'}",
    "trigger": "cicd"
  }'`}
            language="bash"
            maxHeight="max-h-36"
          />
        </div>

        <div className="glass-card p-5 rounded-xl space-y-3">
          <h4 className="text-sm font-semibold text-slate-200">Query Test Run Status</h4>
          <CodeViewer
            code={`curl http://localhost:4000/api/test-runs/run_sample_id \\
  -H "Accept: application/json"`}
            language="bash"
            maxHeight="max-h-36"
          />
        </div>
      </div>
    </div>
  );
};
