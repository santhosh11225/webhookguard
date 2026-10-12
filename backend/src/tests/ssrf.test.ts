import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import dns from 'node:dns';
import {
  validateHostOrIpPreDns,
  validateTargetUrl,
  isRestrictedIpv4,
  isRestrictedIpv6,
  SsrfBlockedError,
} from '../utils/ssrfValidator.js';
import { TestRunnerService } from '../services/testRunner.service.js';

describe('SSRF Protection & Network Client Isolation', () => {
  describe('Pre-DNS Synchronous Validation (Zero Network & Zero DNS)', () => {
    const restrictedUrls = [
      // Cloud Instance Metadata (AWS, Azure, GCP, Alibaba, OpenStack)
      'http://169.254.169.254/latest/meta-data/',
      'http://169.254.169.254:80/latest/user-data',
      'http://169.254.1.1/internal',
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://metadata.internal/meta',
      'http://100.100.100.200/latest/meta-data/',
      // IPv4 Loopback
      'http://127.0.0.1:8080/admin',
      'http://127.0.0.2:9000/',
      'http://localhost/webhooks',
      'http://sub.localhost:3000/',
      // IPv4 Private (RFC 1918)
      'http://10.0.0.1/internal-api',
      'http://172.16.0.1/status',
      'http://172.31.255.255/',
      'http://192.168.1.1:8000/',
      'http://192.168.0.100/config',
      // Carrier-Grade NAT (RFC 6598)
      'http://100.64.0.1/',
      'http://100.127.255.255/',
      // Unspecified & Broadcast
      'http://0.0.0.0:8000/',
      'http://255.255.255.255/',
      // IPv6 Loopback
      'http://[::1]:8080/',
      // IPv6 Link-Local
      'http://[fe80::1]/',
      'http://[fe80::200:5aee:feaa:20a2]/',
      // IPv6 Unique Local / Private (RFC 4193) & IMDSv6
      'http://[fc00::1]/',
      'http://[fd00::1]/',
      'http://[fd00:ec2::254]/latest/meta-data/',
      // IPv4-Mapped IPv6
      'http://[::ffff:127.0.0.1]/',
      'http://[::ffff:169.254.169.254]/',
      'http://[::ffff:10.0.0.1]/',
    ];

    for (const url of restrictedUrls) {
      it(`blocks ${url} pre-DNS before any network or resolution call`, () => {
        assert.throws(
          () => {
            validateHostOrIpPreDns(url, { allowLocalNetworks: false });
          },
          (err: any) => {
            assert.ok(err instanceof SsrfBlockedError, `Expected SsrfBlockedError for ${url}`);
            assert.ok(err.isSsrfBlocked);
            return true;
          }
        );
      });
    }
  });

  describe('DNS Resolution SSRF Inspection', () => {
    it('blocks hostname resolving to private 10.0.0.5 before network client is called', async () => {
      const originalLookup = dns.promises.lookup;
      const lookupMock = mock.fn(async () => [
        { address: '10.0.0.5', family: 4 },
      ]);
      dns.promises.lookup = lookupMock as any;

      try {
        await assert.rejects(
          async () => {
            await validateTargetUrl('http://attacker-controlled.example.com/hook', { allowLocalNetworks: false });
          },
          (err: any) => {
            assert.ok(err instanceof SsrfBlockedError);
            assert.match(err.message, /Hostname resolves to restricted IPv4/);
            return true;
          }
        );
      } finally {
        dns.promises.lookup = originalLookup;
      }
    });

    it('blocks hostname resolving to loopback 127.0.0.1 before network client is called', async () => {
      const originalLookup = dns.promises.lookup;
      const lookupMock = mock.fn(async () => [
        { address: '127.0.0.1', family: 4 },
      ]);
      dns.promises.lookup = lookupMock as any;

      try {
        await assert.rejects(
          async () => {
            await validateTargetUrl('http://spoofed-local.example.com/hook', { allowLocalNetworks: false });
          },
          (err: any) => {
            assert.ok(err instanceof SsrfBlockedError);
            assert.match(err.message, /Hostname resolves to restricted IPv4/);
            return true;
          }
        );
      } finally {
        dns.promises.lookup = originalLookup;
      }
    });

    it('blocks hostname resolving to IPv6 loopback ::1 before network client is called', async () => {
      const originalLookup = dns.promises.lookup;
      const lookupMock = mock.fn(async () => [
        { address: '::1', family: 6 },
      ]);
      dns.promises.lookup = lookupMock as any;

      try {
        await assert.rejects(
          async () => {
            await validateTargetUrl('http://spoofed-ipv6.example.com/hook', { allowLocalNetworks: false });
          },
          (err: any) => {
            assert.ok(err instanceof SsrfBlockedError);
            assert.match(err.message, /Hostname resolves to restricted IPv6/);
            return true;
          }
        );
      } finally {
        dns.promises.lookup = originalLookup;
      }
    });
  });

  describe('Network Client Isolation (fetch() is NEVER called for blocked targets)', () => {
    it('confirms network client (fetch) is never called for cloud metadata', async () => {
      const originalFetch = globalThis.fetch;
      const fetchSpy = mock.fn(async () => {
        throw new Error('SECURITY VIOLATION: fetch was called on cloud metadata IP!');
      });
      globalThis.fetch = fetchSpy as any;

      try {
        const dummyRepo: any = {
          findById: async () => ({
            id: 'ep-test',
            name: 'Test Ep',
            url: 'https://api.example.com/hook',
            method: 'POST',
            authentication: 'none',
          }),
        };
        const dummySuiteRepo: any = {
          findById: async () => ({
            id: 's-test',
            endpointId: 'ep-test',
            name: 'SSRF Suite',
            tests: [
              {
                id: 'test-ssrf-imds',
                name: 'IMDS Test',
                type: 'ssrf',
                url: 'http://169.254.169.254/latest/meta-data/',
                expectedStatus: 403,
              },
            ],
          }),
        };
        const dummyRunRepo: any = {
          create: async (data: any) => ({ ...data, id: 'run-1' }),
          update: async (_id: string, data: any) => data,
        };
        const dummyResultRepo: any = {
          create: async (data: any) => data,
        };

        const runner = new TestRunnerService(
          dummyRepo,
          dummySuiteRepo,
          dummyRunRepo,
          dummyResultRepo,
          { allowLocalNetworks: false }
        );

        const { run, results } = await runner.executeSuite('ep-test', 's-test', 'manual');

        assert.equal(run.status, 'passed');
        assert.equal(results[0].status, 'PASS');
        assert.equal(results[0].responseTime, 0);
        // Verify fetch was called ZERO times!
        assert.equal(fetchSpy.mock.callCount(), 0, 'fetch must NEVER be called for 169.254.169.254');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('confirms network client is never called for private IP targets', async () => {
      const originalFetch = globalThis.fetch;
      const fetchSpy = mock.fn(async () => {
        throw new Error('SECURITY VIOLATION: fetch was called on private IP!');
      });
      globalThis.fetch = fetchSpy as any;

      try {
        const dummyRepo: any = {
          findById: async () => ({
            id: 'ep-test',
            name: 'Test Ep',
            url: 'https://api.example.com/hook',
            method: 'POST',
            authentication: 'none',
          }),
        };
        const dummySuiteRepo: any = {
          findById: async () => ({
            id: 's-test',
            endpointId: 'ep-test',
            name: 'SSRF Suite',
            tests: [
              {
                id: 'test-ssrf-rfc1918',
                name: 'Private Network Test',
                type: 'ssrf',
                url: 'http://10.0.0.1/admin',
                expectedStatus: 403,
              },
            ],
          }),
        };
        const dummyRunRepo: any = {
          create: async (data: any) => ({ ...data, id: 'run-1' }),
          update: async (_id: string, data: any) => data,
        };
        const dummyResultRepo: any = {
          create: async (data: any) => data,
        };

        const runner = new TestRunnerService(
          dummyRepo,
          dummySuiteRepo,
          dummyRunRepo,
          dummyResultRepo,
          { allowLocalNetworks: false }
        );

        const { run, results } = await runner.executeSuite('ep-test', 's-test', 'manual');

        assert.equal(run.status, 'passed');
        assert.equal(results[0].status, 'PASS');
        assert.equal(fetchSpy.mock.callCount(), 0, 'fetch must NEVER be called for 10.0.0.1');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('confirms network client is never called for redirect destination pointing to cloud metadata', async () => {
      const originalFetch = globalThis.fetch;
      const originalLookup = dns.promises.lookup;

      dns.promises.lookup = mock.fn(async () => [
        { address: '93.184.216.34', family: 4 },
      ]) as any;

      // Mock fetch: returns a 302 redirect pointing to 169.254.169.254 on the first hop
      const fetchSpy = mock.fn(async (url: any) => {
        if (url === 'https://public-hook.example.com/start') {
          return new Response(null, {
            status: 302,
            headers: {
              Location: 'http://169.254.169.254/latest/meta-data/',
            },
          });
        }
        throw new Error(`SECURITY VIOLATION: fetch was called on redirect destination: ${url}`);
      });
      globalThis.fetch = fetchSpy as any;

      try {
        const dummyRepo: any = {
          findById: async () => ({
            id: 'ep-test',
            name: 'Test Ep',
            url: 'https://public-hook.example.com/start',
            method: 'POST',
            authentication: 'none',
          }),
        };
        const dummySuiteRepo: any = {
          findById: async () => ({
            id: 's-test',
            endpointId: 'ep-test',
            name: 'SSRF Redirect Suite',
            tests: [
              {
                id: 'test-ssrf-redirect',
                name: 'SSRF Redirect Attempt',
                type: 'ssrf',
                url: 'https://public-hook.example.com/start',
                expectedStatus: 403,
              },
            ],
          }),
        };
        const dummyRunRepo: any = {
          create: async (data: any) => ({ ...data, id: 'run-1' }),
          update: async (_id: string, data: any) => data,
        };
        const dummyResultRepo: any = {
          create: async (data: any) => data,
        };

        const runner = new TestRunnerService(
          dummyRepo,
          dummySuiteRepo,
          dummyRunRepo,
          dummyResultRepo,
          { allowLocalNetworks: false }
        );

        const { run, results } = await runner.executeSuite('ep-test', 's-test', 'manual');

        assert.equal(run.status, 'passed');
        assert.equal(results[0].status, 'PASS');
        // Initial request was made (call count = 1), but the redirect destination was blocked BEFORE fetch!
        assert.equal(fetchSpy.mock.callCount(), 1);
        assert.equal(fetchSpy.mock.calls[0].arguments[0], 'https://public-hook.example.com/start');
      } finally {
        globalThis.fetch = originalFetch;
        dns.promises.lookup = originalLookup;
      }
    });

    it('confirms network client is never called for redirect destination pointing to 127.0.0.1', async () => {
      const originalFetch = globalThis.fetch;
      const originalLookup = dns.promises.lookup;

      dns.promises.lookup = mock.fn(async () => [
        { address: '93.184.216.34', family: 4 },
      ]) as any;

      const fetchSpy = mock.fn(async (url: any) => {
        if (url === 'https://public-hook.example.com/start') {
          return new Response(null, {
            status: 301,
            headers: {
              Location: 'http://127.0.0.1:8080/admin',
            },
          });
        }
        throw new Error(`SECURITY VIOLATION: fetch was called on loopback redirect destination: ${url}`);
      });
      globalThis.fetch = fetchSpy as any;

      try {
        const dummyRepo: any = {
          findById: async () => ({
            id: 'ep-test',
            name: 'Test Ep',
            url: 'https://public-hook.example.com/start',
            method: 'POST',
            authentication: 'none',
          }),
        };
        const dummySuiteRepo: any = {
          findById: async () => ({
            id: 's-test',
            endpointId: 'ep-test',
            name: 'SSRF Redirect Suite',
            tests: [
              {
                id: 'test-ssrf-redirect-local',
                name: 'SSRF Loopback Redirect Attempt',
                type: 'ssrf',
                url: 'https://public-hook.example.com/start',
                expectedStatus: 403,
              },
            ],
          }),
        };
        const dummyRunRepo: any = {
          create: async (data: any) => ({ ...data, id: 'run-1' }),
          update: async (_id: string, data: any) => data,
        };
        const dummyResultRepo: any = {
          create: async (data: any) => data,
        };

        const runner = new TestRunnerService(
          dummyRepo,
          dummySuiteRepo,
          dummyRunRepo,
          dummyResultRepo,
          { allowLocalNetworks: false }
        );

        const { run, results } = await runner.executeSuite('ep-test', 's-test', 'manual');

        assert.equal(run.status, 'passed');
        assert.equal(results[0].status, 'PASS');
        assert.equal(fetchSpy.mock.callCount(), 1);
      } finally {
        globalThis.fetch = originalFetch;
        dns.promises.lookup = originalLookup;
      }
    });
  });
});
