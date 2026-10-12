import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Webhook,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  RotateCw,
  Search,
  Key,
} from 'lucide-react';
import { api } from '../services/api';
import { Endpoint, EndpointCreateInput, AuthType, Environment, HttpMethod } from '../types';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { AuthBadge, EnvBadge } from '../components/common/Badge';
import { useToast } from '../context/ToastContext';

export const DEFAULT_MOCK_PAYMENT_URL = 'http://localhost:4000/api/mock-webhooks/payment';
export const DEFAULT_MOCK_PAYMENT_SECRET = 'whsec_test_98af21d09e023190ab78ff09a1';

export const EndpointsPage: React.FC = () => {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<Endpoint | null>(null);
  const [formData, setFormData] = useState<EndpointCreateInput>({
    name: '',
    url: '',
    method: 'POST',
    authentication: 'hmac',
    secret: '',
    headers: {},
    environment: 'development',
  });
  const [headersText, setHeadersText] = useState('{\n  "Content-Type": "application/json"\n}');
  const [saving, setSaving] = useState(false);

  const toast = useToast();

  const loadEndpoints = async () => {
    try {
      setLoading(true);
      const list = await api.getEndpoints();
      setEndpoints(list);
    } catch (err: any) {
      toast.error('Failed to load endpoints', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEndpoints();
  }, []);

  const openCreateModal = () => {
    setEditingEndpoint(null);
    setFormData({
      name: '',
      url: DEFAULT_MOCK_PAYMENT_URL,
      method: 'POST',
      authentication: 'hmac',
      secret: DEFAULT_MOCK_PAYMENT_SECRET,
      headers: { 'Content-Type': 'application/json' },
      environment: 'development',
    });
    setHeadersText('{\n  "Content-Type": "application/json"\n}');
    setIsModalOpen(true);
  };

  const openEditModal = (ep: Endpoint) => {
    setEditingEndpoint(ep);
    setFormData({
      name: ep.name,
      url: ep.url,
      method: ep.method,
      authentication: ep.authentication,
      secret: '', // Do not display existing secret
      headers: ep.headers,
      environment: ep.environment,
    });
    setHeadersText(JSON.stringify(ep.headers || {}, null, 2));
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      let parsedHeaders = {};
      try {
        parsedHeaders = JSON.parse(headersText);
      } catch {
        throw new Error('Headers must be valid JSON');
      }

      const payload = {
        ...formData,
        headers: parsedHeaders,
      };

      if (editingEndpoint) {
        await api.updateEndpoint(editingEndpoint.id, payload);
        toast.success('Endpoint updated', `${payload.name} has been updated.`);
      } else {
        await api.createEndpoint(payload);
        toast.success('Endpoint registered', `${payload.name} has been added.`);
      }

      setIsModalOpen(false);
      loadEndpoints();
    } catch (err: any) {
      toast.error('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ep: Endpoint) => {
    if (!confirm(`Are you sure you want to delete "${ep.name}"? All associated suites will be deleted.`)) return;
    try {
      await api.deleteEndpoint(ep.id);
      toast.success('Endpoint deleted', `${ep.name} was removed.`);
      loadEndpoints();
    } catch (err: any) {
      toast.error('Delete failed', err.message);
    }
  };

  const filtered = endpoints.filter(
    (ep) =>
      ep.name.toLowerCase().includes(search.toLowerCase()) ||
      ep.url.toLowerCase().includes(search.toLowerCase()) ||
      ep.environment.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-[#333333] tracking-tight">Registered Endpoints</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage target webhook URLs, authentication methods, and environment configurations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={loadEndpoints}
            icon={<RotateCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <Button size="sm" variant="primary" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
            Add Webhook Endpoint
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white border border-gray-200 p-4 rounded-lg flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by endpoint name, URL, or environment..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded pl-9 pr-4 py-2 text-xs text-[#333333] placeholder-gray-400 focus:outline-none focus:border-blue-600"
          />
        </div>
        <div className="text-xs text-gray-500 shrink-0">
          Showing {filtered.length} of {endpoints.length} endpoints
        </div>
      </div>

      {/* Endpoints List / Grid */}
      {loading ? (
        <div className="text-center py-12 text-gray-500 text-sm">Loading endpoints...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 text-center rounded-lg space-y-4">
          <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center mx-auto text-gray-500">
            <Webhook className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-[#333333]">No Webhook Endpoints Found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {search ? 'Try clearing your search criteria.' : 'Register your first webhook endpoint to start automated testing.'}
          </p>
          <Button size="sm" variant="primary" onClick={openCreateModal} icon={<Plus className="w-4 h-4" />}>
            Add Webhook Endpoint
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((ep) => (
            <div key={ep.id} className="bg-white border border-gray-200 p-5 rounded-lg space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-[#333333]">
                      {ep.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-gray-100 text-[#333333] border border-gray-200">
                        {ep.method}
                      </span>
                      <AuthBadge auth={ep.authentication} />
                      <EnvBadge env={ep.environment} />
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(ep)}
                      className="p-1.5 rounded text-gray-400 hover:text-[#333333] hover:bg-gray-100 transition-colors"
                      title="Edit Endpoint"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(ep)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete Endpoint"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 p-2.5 rounded bg-gray-50 border border-gray-200 text-xs font-mono text-[#333333] break-all flex items-center justify-between gap-2">
                  <span className="truncate">{ep.url}</span>
                  <a
                    href={ep.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-400 hover:text-blue-600 shrink-0"
                    title="Open URL in new tab"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {ep.authentication !== 'none' && (
                  <div className="mt-2 text-[11px] font-mono text-gray-500 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-gray-400" />
                    <span>Secret Key:</span>
                    <span className="text-gray-400 tracking-widest">{ep.secret || '••••••••••••••••'}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-between gap-2">
                <Link to={`/suites?endpointId=${ep.id}`}>
                  <Button size="sm" variant="secondary" className="text-xs py-1">
                    Manage Suites
                  </Button>
                </Link>

                <Link to={`/runs?endpointId=${ep.id}`}>
                  <Button size="sm" variant="ghost" className="text-xs py-1 text-gray-600 hover:text-[#333333]">
                    View Run History
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEndpoint ? 'Edit Webhook Endpoint' : 'Register Webhook Endpoint'}
        subtitle="Configure the target endpoint URL, authentication protocol, and environment."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#333333] mb-1">Endpoint Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Stripe Payment Webhook"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-[#333333] focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#333333] mb-1">HTTP Method</label>
              <select
                value={formData.method}
                onChange={(e) => setFormData({ ...formData, method: e.target.value as HttpMethod })}
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-[#333333] focus:outline-none focus:border-blue-600 font-mono"
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-semibold text-[#333333] mb-1">Environment</label>
              <select
                value={formData.environment}
                onChange={(e) => setFormData({ ...formData, environment: e.target.value as Environment })}
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-[#333333] focus:outline-none focus:border-blue-600"
              >
                <option value="development">Development (Local)</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#333333]">Webhook Target URL</label>
              <button
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    url: DEFAULT_MOCK_PAYMENT_URL,
                    authentication: 'hmac',
                    secret: DEFAULT_MOCK_PAYMENT_SECRET,
                  })
                }
                className="text-[10px] text-blue-600 hover:underline"
              >
                Use Built-in Payment Mock
              </button>
            </div>
            <input
              type="url"
              required
              placeholder="https://api.yourdomain.com/webhooks/orders"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-[#333333] font-mono focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#333333] mb-1">Authentication</label>
              <select
                value={formData.authentication}
                onChange={(e) => setFormData({ ...formData, authentication: e.target.value as AuthType })}
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-[#333333] focus:outline-none focus:border-blue-600 font-mono"
              >
                <option value="none">None</option>
                <option value="hmac">HMAC-SHA256</option>
                <option value="bearer">Bearer Token</option>
                <option value="api_key">API Key</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#333333] mb-1">
                {formData.authentication === 'hmac'
                  ? 'HMAC Secret Key'
                  : formData.authentication === 'bearer'
                  ? 'Bearer Token'
                  : formData.authentication === 'api_key'
                  ? 'API Key Secret'
                  : 'Secret (Unused)'}
              </label>
              <input
                type="password"
                placeholder={
                  editingEndpoint
                    ? 'Leave blank to keep existing'
                    : 'e.g. whsec_test_98af21d09e023190ab78ff09a1'
                }
                value={formData.secret || ''}
                onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                disabled={formData.authentication === 'none'}
                className="w-full bg-white border border-gray-200 rounded px-3 py-2 text-xs text-[#333333] font-mono focus:outline-none focus:border-blue-600 disabled:opacity-40"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#333333] mb-1">
              Custom Headers (JSON)
            </label>
            <textarea
              rows={3}
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded p-2.5 text-xs text-[#333333] font-mono focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              {editingEndpoint ? 'Save Changes' : 'Register Endpoint'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
