import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Boxes,
  Plus,
  Play,
  Edit2,
  Trash2,
  RotateCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Repeat,
  ShieldAlert,
  Sliders,
  ChevronDown,
  ChevronUp,
  FileCode,
} from 'lucide-react';
import { api } from '../services/api';
import { TestSuite, Endpoint, TestCase, TestCaseType, TestSuiteCreateInput } from '../types';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { useToast } from '../context/ToastContext';

export const TestSuitesPage: React.FC = () => {
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningSuiteId, setRunningSuiteId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEndpointId = searchParams.get('endpointId') || '';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSuite, setEditingSuite] = useState<TestSuite | null>(null);
  const [suiteFormData, setSuiteFormData] = useState<TestSuiteCreateInput>({
    endpointId: '',
    name: '',
    description: '',
    tests: [],
  });

  // Test Case editor inside Suite modal
  const [selectedTestCaseIdx, setSelectedTestCaseIdx] = useState<number | null>(null);

  const toast = useToast();
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      setLoading(true);
      const [eps, suList] = await Promise.all([
        api.getEndpoints(),
        api.getTestSuites(selectedEndpointId || undefined),
      ]);
      setEndpoints(eps);
      setSuites(suList);
    } catch (err: any) {
      toast.error('Failed to load test suites', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedEndpointId]);

  const handleRunSuite = async (suite: TestSuite) => {
    try {
      setRunningSuiteId(suite.id);
      toast.info('Executing Test Suite', `Running ${suite.tests.length} automated tests against webhook endpoint...`);
      const result = await api.triggerTestRun(suite.endpointId, suite.id, 'manual');
      toast.success(
        'Execution Complete',
        `Finished run #${result.runId.slice(0, 8)}: ${result.passed} passed, ${result.failed} failed.`
      );
      navigate(`/runs/${result.runId}`);
    } catch (err: any) {
      toast.error('Execution Failed', err.message);
    } finally {
      setRunningSuiteId(null);
    }
  };

  const openCreateModal = () => {
    setEditingSuite(null);
    setSuiteFormData({
      endpointId: selectedEndpointId || (endpoints[0]?.id ?? ''),
      name: 'Webhook Reliability & Security Suite',
      description: 'Automated validation for valid requests, malformed data, timeouts, and auth failures.',
      tests: [
        {
          id: 'test-1',
          name: 'Valid Payload Acceptance',
          type: 'valid',
          method: 'POST',
          expectedStatus: 200,
          payload: { event: 'payment.success', transaction_id: 'txn_auto_001', amount: 1500 },
          timeoutMs: 5000,
          retryCount: 1,
        },
        {
          id: 'test-2',
          name: 'Missing Transaction ID',
          type: 'missing_field',
          method: 'POST',
          expectedStatus: 400,
          payload: { event: 'payment.success', amount: 1500 },
          timeoutMs: 5000,
          retryCount: 1,
        },
        {
          id: 'test-3',
          name: 'Invalid HMAC Signature Audit',
          type: 'invalid_hmac',
          method: 'POST',
          expectedStatus: 401,
          payload: { event: 'payment.success', transaction_id: 'txn_forged_999' },
          timeoutMs: 5000,
          retryCount: 1,
        },
        {
          id: 'test-4',
          name: 'Timeout SLA Condition',
          type: 'timeout',
          method: 'POST',
          expectedStatus: 200,
          payload: { event: 'payment.slow' },
          timeoutMs: 2000,
          retryCount: 1,
        },
      ],
    });
    setSelectedTestCaseIdx(0);
    setIsModalOpen(true);
  };

  const openEditModal = (suite: TestSuite) => {
    setEditingSuite(suite);
    setSuiteFormData({
      endpointId: suite.endpointId,
      name: suite.name,
      description: suite.description || '',
      tests: JSON.parse(JSON.stringify(suite.tests)),
    });
    setSelectedTestCaseIdx(suite.tests.length > 0 ? 0 : null);
    setIsModalOpen(true);
  };

  const handleSaveSuite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!suiteFormData.endpointId) {
        throw new Error('Please select an endpoint for this test suite');
      }
      if (editingSuite) {
        await api.updateTestSuite(editingSuite.id, suiteFormData);
        toast.success('Suite Updated', `${suiteFormData.name} has been updated.`);
      } else {
        await api.createTestSuite(suiteFormData);
        toast.success('Suite Created', `${suiteFormData.name} has been created.`);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error('Save Failed', err.message);
    }
  };

  const handleDeleteSuite = async (suite: TestSuite) => {
    if (!confirm(`Delete test suite "${suite.name}"?`)) return;
    try {
      await api.deleteTestSuite(suite.id);
      toast.success('Suite Deleted', `${suite.name} was removed.`);
      loadData();
    } catch (err: any) {
      toast.error('Delete Failed', err.message);
    }
  };

  const addPresetTest = (type: TestCaseType) => {
    const newTest: TestCase = {
      id: `test-${Date.now()}`,
      name: `Test: ${type.replace(/_/g, ' ').toUpperCase()}`,
      type,
      method: 'POST',
      expectedStatus: type === 'valid' ? 200 : type === 'invalid_hmac' || type === 'missing_auth' ? 401 : 400,
      payload: type === 'valid' ? { event: 'webhook.ping', id: 'ping_123' } : { event: 'incomplete' },
      timeoutMs: type === 'timeout' ? 2000 : 5000,
      retryCount: type === 'retry' ? 3 : 1,
      retryDelayMs: 400,
    };
    setSuiteFormData({
      ...suiteFormData,
      tests: [...suiteFormData.tests, newTest],
    });
    setSelectedTestCaseIdx(suiteFormData.tests.length);
  };

  const removeTest = (index: number) => {
    const updated = suiteFormData.tests.filter((_, i) => i !== index);
    setSuiteFormData({ ...suiteFormData, tests: updated });
    setSelectedTestCaseIdx(updated.length > 0 ? Math.max(0, index - 1) : null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Test Suite Builder</h2>
          <p className="text-xs text-slate-400 mt-1">
            Build, configure, and execute automated test suites with real HTTP assertions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={loadData}
            icon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Button size="sm" variant="glow" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
            Create Test Suite
          </Button>
        </div>
      </div>

      {/* Endpoint Selector Filter */}
      <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-300 w-full sm:w-auto">
          <span className="font-semibold text-slate-400">Filter by Endpoint:</span>
          <select
            value={selectedEndpointId}
            onChange={(e) => setSearchParams(e.target.value ? { endpointId: e.target.value } : {})}
            className="bg-dark-900 border border-dark-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
          >
            <option value="">All Endpoints ({suites.length} Suites)</option>
            {endpoints.map((ep) => (
              <option key={ep.id} value={ep.id}>
                {ep.name} ({ep.environment})
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Showing {suites.length} test suites
        </div>
      </div>

      {/* Suites Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading test suites...</div>
      ) : suites.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-dark-800 flex items-center justify-center mx-auto text-slate-400">
            <Boxes className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">No Test Suites Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Create a test suite to validate payload schemas, HMAC cryptography, timeouts, and retries.
          </p>
          <Button size="sm" variant="glow" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
            Create Test Suite
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {suites.map((suite) => {
            const endpoint = endpoints.find((e) => e.id === suite.endpointId);
            const isRunning = runningSuiteId === suite.id;

            return (
              <div key={suite.id} className="glass-card p-5 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white">{suite.name}</h3>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-brand-500/15 text-brand-300 border border-brand-500/30">
                        {suite.tests.length} tests
                      </span>
                    </div>
                    {suite.description && (
                      <p className="text-xs text-slate-400 mt-1">{suite.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs font-mono text-slate-400">
                      <span>Target Endpoint:</span>
                      <span className="text-slate-200 font-semibold">{endpoint?.name || suite.endpointId}</span>
                      {endpoint && (
                        <span className="text-slate-500 truncate max-w-md">({endpoint.url})</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="glow"
                      onClick={() => handleRunSuite(suite)}
                      loading={isRunning}
                      icon={<Play className="w-3.5 h-3.5" />}
                    >
                      Run Test Suite
                    </Button>

                    <button
                      onClick={() => openEditModal(suite)}
                      className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dark-700/60 transition-colors"
                      title="Edit Suite"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteSuite(suite)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                      title="Delete Suite"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Test Cases Overview Badges */}
                <div className="pt-2 border-t border-dark-700/60">
                  <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-2">
                    Included Test Scenarios:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {suite.tests.map((test, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-dark-900/90 border border-dark-800 text-xs flex flex-col justify-between"
                      >
                        <div className="font-semibold text-slate-200 truncate">{test.name}</div>
                        <div className="flex items-center justify-between text-[11px] mt-1.5 font-mono">
                          <span className="text-slate-500 uppercase">{test.type}</span>
                          <span className="text-emerald-400 font-semibold">Exp: {test.expectedStatus}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Suite Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        maxWidth="4xl"
        title={editingSuite ? 'Edit Test Suite' : 'Create Test Suite'}
        subtitle="Define test assertions, payload schemas, timeouts, and expected status codes."
      >
        <form onSubmit={handleSaveSuite} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Endpoint</label>
              <select
                value={suiteFormData.endpointId}
                onChange={(e) => setSuiteFormData({ ...suiteFormData, endpointId: e.target.value })}
                required
                className="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="" disabled>
                  Select an endpoint...
                </option>
                {endpoints.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.name} ({ep.environment})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Suite Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Payment Reliability & Security Suite"
                value={suiteFormData.name}
                onChange={(e) => setSuiteFormData({ ...suiteFormData, name: e.target.value })}
                className="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
            <input
              type="text"
              placeholder="Brief summary of what this suite validates"
              value={suiteFormData.description || ''}
              onChange={(e) => setSuiteFormData({ ...suiteFormData, description: e.target.value })}
              className="w-full bg-dark-950 border border-dark-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Test Case Builder Section */}
          <div className="space-y-3 pt-2 border-t border-dark-700/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Test Cases ({suiteFormData.tests.length})</h4>
                <p className="text-[11px] text-slate-400">Add predefined test scenarios or customize payloads.</p>
              </div>

              {/* Presets Button Palette */}
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => addPresetTest('valid')}
                  className="text-[11px] py-1"
                >
                  + Valid
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => addPresetTest('missing_field')}
                  className="text-[11px] py-1"
                >
                  + Missing Field
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => addPresetTest('malformed_json')}
                  className="text-[11px] py-1"
                >
                  + Malformed
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => addPresetTest('invalid_hmac')}
                  className="text-[11px] py-1 text-purple-300 border-purple-500/30"
                >
                  + Invalid HMAC
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => addPresetTest('timeout')}
                  className="text-[11px] py-1 text-amber-300 border-amber-500/30"
                >
                  + Timeout
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => addPresetTest('retry')}
                  className="text-[11px] py-1 text-cyan-300 border-cyan-500/30"
                >
                  + Retry
                </Button>
              </div>
            </div>

            {/* Test cases list & editor */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Left Column: Test list */}
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {suiteFormData.tests.map((test, idx) => (
                  <div
                    key={test.id || idx}
                    onClick={() => setSelectedTestCaseIdx(idx)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                      selectedTestCaseIdx === idx
                        ? 'bg-brand-600/20 border-brand-500/60 text-white'
                        : 'bg-dark-900 border-dark-800 text-slate-300 hover:bg-dark-800'
                    }`}
                  >
                    <div className="truncate flex-1 pr-2">
                      <div className="font-semibold truncate">{test.name}</div>
                      <div className="text-[10px] opacity-75 font-mono">
                        {test.type} • Exp: {test.expectedStatus}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeTest(idx);
                      }}
                      className="text-slate-500 hover:text-rose-400 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Right Column: Selected Test Case Editor */}
              <div className="md:col-span-2 bg-dark-950 p-4 rounded-xl border border-dark-800 space-y-3">
                {selectedTestCaseIdx !== null && suiteFormData.tests[selectedTestCaseIdx] ? (
                  (() => {
                    const test = suiteFormData.tests[selectedTestCaseIdx];
                    const updateCurrentTest = (updates: Partial<TestCase>) => {
                      const updated = [...suiteFormData.tests];
                      updated[selectedTestCaseIdx] = { ...test, ...updates };
                      setSuiteFormData({ ...suiteFormData, tests: updated });
                    };

                    return (
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block font-semibold text-slate-300 mb-1">Test Name</label>
                            <input
                              type="text"
                              value={test.name}
                              onChange={(e) => updateCurrentTest({ name: e.target.value })}
                              className="w-full bg-dark-900 border border-dark-700 rounded p-1.5 text-slate-200"
                            />
                          </div>
                          <div>
                            <label className="block font-semibold text-slate-300 mb-1">Expected HTTP Status</label>
                            <input
                              type="number"
                              value={test.expectedStatus}
                              onChange={(e) => updateCurrentTest({ expectedStatus: parseInt(e.target.value, 10) || 200 })}
                              className="w-full bg-dark-900 border border-dark-700 rounded p-1.5 text-slate-200 font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="block font-semibold text-slate-300 mb-1">Type</label>
                            <select
                              value={test.type}
                              onChange={(e) => updateCurrentTest({ type: e.target.value as TestCaseType })}
                              className="w-full bg-dark-900 border border-dark-700 rounded p-1.5 text-slate-200 font-mono text-xs"
                            >
                              <option value="valid">Valid Payload</option>
                              <option value="missing_field">Missing Field</option>
                              <option value="malformed_json">Malformed JSON</option>
                              <option value="empty_payload">Empty Payload</option>
                              <option value="invalid_data_type">Invalid Data Type</option>
                              <option value="invalid_hmac">Invalid HMAC</option>
                              <option value="missing_auth">Missing Auth</option>
                              <option value="timeout">Timeout</option>
                              <option value="retry">Retry</option>
                              <option value="custom">Custom</option>
                            </select>
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-300 mb-1">Method</label>
                            <select
                              value={test.method || 'POST'}
                              onChange={(e) => updateCurrentTest({ method: e.target.value as any })}
                              className="w-full bg-dark-900 border border-dark-700 rounded p-1.5 text-slate-200 font-mono text-xs"
                            >
                              <option value="POST">POST</option>
                              <option value="GET">GET</option>
                              <option value="PUT">PUT</option>
                              <option value="PATCH">PATCH</option>
                              <option value="DELETE">DELETE</option>
                            </select>
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-300 mb-1">Timeout (ms)</label>
                            <input
                              type="number"
                              value={test.timeoutMs || 5000}
                              onChange={(e) => updateCurrentTest({ timeoutMs: parseInt(e.target.value, 10) || 5000 })}
                              className="w-full bg-dark-900 border border-dark-700 rounded p-1.5 text-slate-200 font-mono text-xs"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-300 mb-1">Retries</label>
                            <input
                              type="number"
                              min={1}
                              max={5}
                              value={test.retryCount || 1}
                              onChange={(e) => updateCurrentTest({ retryCount: parseInt(e.target.value, 10) || 1 })}
                              className="w-full bg-dark-900 border border-dark-700 rounded p-1.5 text-slate-200 font-mono text-xs"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block font-semibold text-slate-300">
                              Custom Headers (JSON - e.g. custom X-Signature, Auth)
                            </label>
                            <span className="text-[10px] text-slate-500 font-mono">Optional</span>
                          </div>
                          <textarea
                            rows={2}
                            placeholder='{"X-Signature": "custom_or_tampered_signature"}'
                            value={
                              test.headers ? (typeof test.headers === 'object' ? JSON.stringify(test.headers, null, 2) : test.headers) : ''
                            }
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                updateCurrentTest({ headers: parsed });
                              } catch {
                                if (!e.target.value.trim()) {
                                  updateCurrentTest({ headers: undefined });
                                }
                              }
                            }}
                            className="w-full bg-dark-900 border border-dark-700 rounded p-1.5 text-slate-200 font-mono text-[11px]"
                          />
                        </div>

                        <div>
                          <label className="block font-semibold text-slate-300 mb-1">
                            Payload (JSON or string)
                          </label>
                          <textarea
                            rows={5}
                            value={
                              typeof test.payload === 'object'
                                ? JSON.stringify(test.payload, null, 2)
                                : test.payload || ''
                            }
                            onChange={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                updateCurrentTest({ payload: parsed });
                              } catch {
                                updateCurrentTest({ payload: e.target.value });
                              }
                            }}
                            className="w-full bg-dark-900 border border-dark-700 rounded p-2 text-slate-200 font-mono text-[11px]"
                          />
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-center py-10 text-slate-500">Select or add a test case to edit properties.</div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-dark-700/60">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="glow">
              {editingSuite ? 'Save Changes' : 'Create Suite'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
