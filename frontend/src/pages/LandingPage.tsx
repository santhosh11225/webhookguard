import React from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  ShieldCheck,
  Zap,
  Repeat,
  Clock,
  FileCheck,
  GitBranch,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Server,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Button } from '../components/common/Button';

export const LandingPage: React.FC = () => {
  return (
    <div className="space-y-24 py-12 px-6 lg:px-12 max-w-7xl mx-auto">
      {/* Hero Section */}
      <section className="text-center space-y-8 pt-8 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-300 border border-brand-500/30 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span>Automated Webhook API Testing & Reliability Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Test Every Webhook.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-accent-cyan to-brand-300">
            Catch Failures Before Production.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
          Automated webhook testing, security validation, reliability checks, and CI/CD-ready
          quality gates for modern development, QA, and DevOps teams.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link to="/dashboard">
            <Button size="lg" variant="glow" icon={<Zap className="w-5 h-5" />}>
              Start Testing Now
            </Button>
          </Link>
          <Link to="/runs">
            <Button size="lg" variant="secondary" icon={<ShieldCheck className="w-5 h-5" />}>
              View Live Demo Results
            </Button>
          </Link>
        </div>

        {/* Live Simulation Visual Preview */}
        <div className="pt-8">
          <div className="glass-panel p-6 rounded-2xl shadow-2xl text-left font-mono text-xs border border-dark-700/80">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-dark-700/60 text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-3 font-semibold text-slate-300">
                  POST /webhooks/payment — Automated Execution Trace
                </span>
              </div>
              <span className="text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-500/30">
                REAL HTTP ENGINE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 bg-dark-900/90 p-4 rounded-xl border border-dark-800">
                <div className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                  Test Scenarios Under Evaluation
                </div>
                <div className="space-y-1.5 pt-1 text-slate-300">
                  <div className="flex items-center justify-between text-emerald-400">
                    <span>✓ Valid Payment Payload</span>
                    <span className="text-slate-500 text-[11px]">200 OK • 74ms</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-400">
                    <span>✓ Missing Required Field (transaction_id)</span>
                    <span className="text-slate-500 text-[11px]">400 Bad Request • 8ms</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-400">
                    <span>✓ Malformed JSON Syntax</span>
                    <span className="text-slate-500 text-[11px]">400 Bad Request • 5ms</span>
                  </div>
                  <div className="flex items-center justify-between text-purple-400 font-bold bg-purple-950/40 px-2 py-1 rounded border border-purple-500/30">
                    <span>⚠️ Invalid HMAC Signature Rejection</span>
                    <span>401 Unauthorized</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-400">
                    <span>✓ Retry Loop on Transient 503</span>
                    <span className="text-slate-500 text-[11px]">Attempt 3 • 200 OK</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 bg-dark-900/90 p-4 rounded-xl border border-dark-800">
                <div className="text-slate-400 text-[11px] uppercase tracking-wider font-semibold">
                  HMAC-SHA256 Security Audit
                </div>
                <div className="p-3 rounded-lg bg-dark-950 border border-dark-700/60 space-y-1.5 text-[11px]">
                  <div className="text-slate-400">Payload: <span className="text-slate-200">{`{"event":"payment.success","amount":4999}`}</span></div>
                  <div className="text-slate-400">Secret: <span className="text-slate-500">whsec_••••••••••••••••</span></div>
                  <div className="text-slate-400">Calculated Signature:</div>
                  <div className="text-brand-300 break-all bg-dark-900 p-1.5 rounded border border-dark-800">
                    sha256=9f83a21bc984210e30948acb1842019ab92140f
                  </div>
                  <div className="text-emerald-400 flex items-center gap-1 pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Cryptographic header injected as X-Signature</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why WebhookGuard? */}
      <section id="features" className="space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold text-white tracking-tight">Why WebhookGuard?</h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
            Webhooks fail silently in production due to malformed payloads, missed auth tokens,
            and unhandled timeouts. WebhookGuard automates verification across the entire lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card p-6 rounded-2xl space-y-3 border-l-4 border-l-brand-500">
            <div className="w-10 h-10 rounded-xl bg-brand-600/20 text-brand-400 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-white">Automated Testing</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Instantly generate test suites covering valid events, missing fields, malformed syntax,
              and empty bodies with configurable assertions.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl space-y-3 border-l-4 border-l-purple-500">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-white">Security Validation</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Validate HMAC-SHA256 cryptographic signatures. Deliberately sends forged webhooks to
              ensure your endpoints strictly return HTTP 401 Unauthorized.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl space-y-3 border-l-4 border-l-amber-500">
            <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center">
              <Repeat className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-white">Retry & Timeout Resilience</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Measure strict SLA response deadlines and verify automatic retry recovery behavior
              across intermittent 500/503 server errors.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl space-y-3 border-l-4 border-l-cyan-500">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-white">Detailed Debugging Reports</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Inspect exact request headers, outgoing payloads, response status codes, timing
              breakdowns, and exportable compliance reports.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl space-y-3 border-l-4 border-l-emerald-500">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
              <GitBranch className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-white">CI/CD Quality Gate</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Trigger automated test runs inside GitHub Actions or GitLab CI. Non-zero exit status
              blocks deployment if breaking webhook issues are detected.
            </p>
          </div>

          <div className="glass-card p-6 rounded-2xl space-y-3 border-l-4 border-l-rose-500">
            <div className="w-10 h-10 rounded-xl bg-rose-600/20 text-rose-400 flex items-center justify-center">
              <Server className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-white">Real HTTP Requests</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              No simulated fakes in test execution. Backend makes actual network calls to your local
              services, staging servers, or external webhook targets.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold text-white tracking-tight">How It Works</h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm">
            Five simple steps to guarantee webhook delivery integrity and reliability.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { step: '01', title: 'Connect Endpoint', desc: 'Register your webhook URL, HTTP method, and HMAC secret key.' },
            { step: '02', title: 'Create Test Suite', desc: 'Select predefined templates or customize expected status codes.' },
            { step: '03', title: 'Run Tests', desc: 'Execute live HTTP requests with real-time latency and signature injection.' },
            { step: '04', title: 'Analyze Results', desc: 'Inspect request/response diffs, retry timelines, and security flags.' },
            { step: '05', title: 'Fix & Deploy', desc: 'Enforce CI/CD quality gates so broken webhook handlers never reach production.' },
          ].map((item, idx) => (
            <div key={idx} className="glass-card p-5 rounded-xl relative group">
              <div className="text-2xl font-extrabold text-brand-500/40 group-hover:text-brand-400 transition-colors font-mono">
                {item.step}
              </div>
              <h4 className="text-base font-semibold text-white mt-2 mb-1">{item.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-bold text-white tracking-tight">Mission-Critical Use Cases</h2>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm">
            Designed for platforms where missed or corrupted webhooks directly impact revenue and security.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: 'Payment Webhooks',
              badge: 'Stripe, PayPal, Adyen',
              desc: 'Verify financial events like charge.succeeded, invoice.payment_failed, and ensure forged events are rejected with 401.',
            },
            {
              title: 'E-Commerce Orders',
              badge: 'Shopify, WooCommerce',
              desc: 'Confirm order fulfillment webhooks survive transient DB lock contention through automated retry recovery.',
            },
            {
              title: 'SaaS Integrations',
              badge: 'Slack, GitHub, HubSpot',
              desc: 'Test incoming third-party notifications against payload schema changes and token rotation.',
            },
            {
              title: 'Microservice Events',
              badge: 'Internal Event Bus',
              desc: 'Stress test internal asynchronous service-to-service webhooks for timeout thresholds and backpressure handling.',
            },
            {
              title: 'Notification Systems',
              badge: 'Twilio, SendGrid',
              desc: 'Validate delivery callbacks and SMS receipt updates with strict timestamp and idempotency assertions.',
            },
            {
              title: 'CI/CD Quality Gates',
              badge: 'GitHub Actions, Jenkins',
              desc: 'Run WebhookGuard suites as an automated pre-deployment check. Reject PRs if webhook contracts break.',
            },
          ].map((uc, i) => (
            <div key={i} className="glass-card p-6 rounded-2xl space-y-3">
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-brand-500/15 text-brand-300 border border-brand-500/30">
                {uc.badge}
              </span>
              <h3 className="text-base font-semibold text-white">{uc.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{uc.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="glass-panel p-10 rounded-3xl border border-brand-500/30 text-center space-y-6 max-w-4xl mx-auto relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-accent-cyan/20 rounded-full blur-3xl pointer-events-none" />

        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          Ready to Harden Your Webhook Infrastructure?
        </h2>
        <p className="text-slate-300 max-w-xl mx-auto text-sm leading-relaxed">
          Launch tests locally or connect your CI/CD pipeline today. Catch payload anomalies and
          security vulnerabilities before your customers do.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link to="/dashboard">
            <Button size="lg" variant="glow" icon={<ArrowRight className="w-5 h-5" />}>
              Open Dashboard
            </Button>
          </Link>
          <Link to="/cicd">
            <Button size="lg" variant="secondary" icon={<GitBranch className="w-5 h-5" />}>
              View CI/CD Integration
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};
