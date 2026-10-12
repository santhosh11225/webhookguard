# WebhookGuard — Automated Webhook API Testing & Reliability Platform

> **"Test every webhook. Catch failures before production."**

![WebhookGuard Architecture](https://img.shields.io/badge/Architecture-Clean%20Layered-6366f1)
![TypeScript](https://img.shields.io/badge/Language-TypeScript%205.7-blue)
![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61dafb)
![Node.js](https://img.shields.io/badge/Backend-Node.js%20%2B%20Express-green)
![SQLite](https://img.shields.io/badge/Database-SQLite%20(WAL%20Mode)-003b57)
![CI/CD](https://img.shields.io/badge/CI%2FCD-Quality%20Gate%20Ready-success)

---

## 1. Product Overview & Architecture

**WebhookGuard** is an automated webhook testing and reliability platform designed for development, QA, and DevOps teams to validate webhook endpoints against valid payloads, malformed requests, missing fields, authentication failures, timeout conditions, retry behavior, and critical security vulnerabilities.

Modern distributed architectures rely heavily on webhooks for real-time events (payment confirmations, shipment updates, inventory syncs). WebhookGuard provides:
- Genuine cryptographic HMAC-SHA256 signing and verification.
- Flexible test case builder (editable HTTP methods, custom headers, payload bodies, expected status codes, timeouts, and retry policies).
- Reliable test runner with SSRF prevention (cloud metadata protection) and total-execution timeout deadlines.
- Live telemetry dashboard and detailed request/response execution inspector.
- CI/CD quality gate endpoint returning `HTTP 422` on assertion failures to block broken builds.

### Layered Architecture

```text
Frontend (React 19 + Vite + Tailwind CSS + Lucide Icons + Recharts)
       ↓  (REST API / JSON)
REST API Controllers & Express Middleware (CORS, Raw Body Capture)
       ↓  (Dependency Injection)
Service Layer (Pure Business Logic, HMAC Verification, Test Runner, Analytics)
       ↓  (Repository Interfaces: IEndpointRepository, ITestSuiteRepository, etc.)
Repository Layer (SQLite Local Database with WAL Mode / DynamoDB Abstraction)
       ↓
Local SQLite Storage (backend/data/webhookguard.sqlite)
```

> [!NOTE]
> **AWS-Ready Design**: Architecture repositories are cleanly abstracted behind TypeScript interfaces. While DynamoDB repositories and SAM templates exist for future deployment, **no live AWS resources are required or created for local operation**.

---

## 2. Prerequisites & Installation

### Prerequisites
- **Node.js**: v18+ (tested and verified on Node.js v24 / v22)
- **npm**: v9+

### Installation
From the root directory:

```bash
# Install root, backend, and frontend dependencies in one command:
npm run install:all
```

Alternatively, install individually:
```bash
npm install
npm install --prefix backend
npm install --prefix frontend
```

---

## 3. Environment Configuration

Pre-configured environment templates are provided in `.env.example`:

### Safe `.env.example`
```env
# Backend Configuration
PORT=4000
NODE_ENV=development
DATA_DIR=./data
DB_PATH=./data/webhookguard.sqlite
MOCK_WEBHOOK_SECRET=whsec_test_98af21d09e023190ab78ff09a1
DEMO_MODE=false

# Frontend Configuration
VITE_API_URL=http://localhost:4000/api
```

### Secret Handling & Hygiene
- Secrets (`MOCK_WEBHOOK_SECRET`, tokens, API keys) are managed in backend environment variables and database records.
- Secrets are **never exposed** in the frontend client, logs, or unmasked API responses.
- The root `.gitignore` excludes `.env`, `*.env`, `backend/data/*.sqlite`, `dist/`, and `node_modules/` to prevent sensitive credentials from ever being committed.

---

## 4. Starting the Application Locally

### Run Backend and Frontend Concurrently
From the root directory:

```bash
npm run dev
```

This launches both servers simultaneously:
- **Backend API**: `http://localhost:4000` (Health: `http://localhost:4000/api/health`)
- **Frontend Dashboard**: `http://localhost:5173`

### Run Independently
```bash
# Start backend API only
npm run dev:backend

# Start frontend dashboard only
npm run dev:frontend
```

---

## 5. Built-in Mock Webhook Receivers

WebhookGuard includes built-in mock endpoints for zero-setup local demonstration:

1. **Payment Webhook**: `http://localhost:4000/api/mock-webhooks/payment`
   - Enforces real HMAC-SHA256 signature verification.
   - Requires valid JSON payload with `transaction_id` and numeric `amount`.
   - Supports simulated delay via `?delay=<ms>` or `event: "payment.heavy_processing"`.
2. **Vulnerable Payment Webhook**: `http://localhost:4000/api/mock-webhooks/payment?vulnerable=true`
   - Intentionally accepts unverified or forged webhooks (`HTTP 200 OK`) so WebhookGuard detects a **`SECURITY FAILURE`**.
3. **Order Sync Webhook**: `http://localhost:4000/api/mock-webhooks/orders`
   - Simulates transient lock contention by returning `HTTP 503` for the first 2 attempts, then recovering with `HTTP 200` on attempt 3.
4. **Retry Counter Reset**: `POST http://localhost:4000/api/mock-webhooks/reset`

---

## 6. Cryptographic HMAC-SHA256 Specification

WebhookGuard implements authentic cryptographic signature generation and verification:

- **Hashing Algorithm**: HMAC-SHA256 (`crypto.createHmac('sha256', secret)`)
- **Header Name**: `X-Signature` (also accepts `X-Hub-Signature-256` or `Signature`)
- **Digest Format**: Hexadecimal encoded digest prefixed with `sha256=` (e.g. `sha256=a1b2c3d4...`)
- **Raw Body Integrity**: Verification computes the digest over the **raw byte string** received over the wire (`req.rawBody`).
- **Constant-Time Comparison**: Evaluated using `crypto.timingSafeEqual` to prevent timing attack side-channels.
- **Negative Security Verification**:
  - Missing signature header -> `HTTP 401 Unauthorized`.
  - Malformed signature format (non-hex or incorrect length) -> `HTTP 401 Unauthorized`.
  - Forged signature or wrong secret -> `HTTP 401 Unauthorized`.
  - Payload modified/tampered after signing -> `HTTP 401 Unauthorized`.

---

## 7. How to Demonstrate Passing and Failing Tests

### Demonstration A: Valid Request (PASS)
1. Navigate to **Test Suites** (`http://localhost:5173/suites`).
2. Run the **Core Payment Reliability & Security Suite**.
3. Scenario **"Valid Payment Payload"**:
   - Sends well-formed JSON payload with valid calculated HMAC signature.
   - Endpoint responds with `HTTP 200 OK`.
   - Result: **`PASS`** (actual 200 == expected 200).

### Demonstration B: Correctly Handled Security Rejection (PASS)
1. In the same suite, inspect **"Invalid HMAC Signature"**:
   - Sends a payload with a cryptographic signature calculated using an unauthorized key.
   - Endpoint rejects with `HTTP 401 Unauthorized`.
   - Test is configured with `expectedStatus: 401`.
   - Result: **`PASS`** (endpoint correctly enforced security).

### Demonstration C: Deliberate Assertion Failure (FAIL)
1. Open the suite editor for **Core Payment Reliability & Security Suite**.
2. Select or create a test case:
   - Configure **Expected HTTP Status**: `200`.
   - Set **Type**: `Invalid HMAC` or modify the payload.
   - Save and click **Run Test Suite**.
   - Receiver responds with `HTTP 401 Unauthorized`.
   - Result: **`FAIL`** (actual 401 != expected 200).

### Demonstration D: Security Vulnerability Alert (`SECURITY FAILURE`)
1. Run the **Security Vulnerability Audit Suite** against the **Legacy Checkout Webhook (Vulnerable Target)**.
2. An invalid signature is sent, but the vulnerable endpoint returns `HTTP 200 OK`.
3. WebhookGuard flags a critical **`SECURITY FAILURE`** with an automated remediation advisory.

### Demonstration E: Transient 503 Retry Recovery
1. Run the **Order Sync & Transient Failure Recovery Suite**.
2. The endpoint returns `503 Service Unavailable` on attempts 1 and 2, and recovers on attempt 3.
3. The test runner records retry attempts and completes with **`PASS`**.

---

## 8. Inspecting Execution History & Dashboard Telemetry

1. **Test Run Detail**: Navigate to `/runs/<runId>` to inspect each test case.
   - Click **Debug** on any test to open the deep inspection modal.
   - View exact request headers (secrets safely masked), raw payload, response status, response body, latency, and retry logs.
2. **Dashboard Telemetry**: Navigate to `/dashboard`:
   - View real-time pass rate, total tests executed, and average latency.
   - Status code distribution pie chart (real executions only, empty states cleanly handled).
   - Historical latency timeline.
3. **Data Persistence**:
   - Refresh the page or restart the server: all endpoints, test suites, test runs, and test results persist in `./data/webhookguard.sqlite`.

---

## 9. CI/CD Quality Gate & GitHub Actions

### Quality Gate Endpoint
```http
POST /api/test-runs?failOnErrors=true
Content-Type: application/json

{
  "endpointId": "<ENDPOINT_ID>",
  "suiteId": "<SUITE_ID>",
  "trigger": "cicd"
}
```

- **All Tests Pass**: Returns `HTTP 201 Created` with `{ "success": true, "status": "passed", ... }`.
- **Any Test Fails**: Returns `HTTP 422 Unprocessable Entity` with `{ "success": false, "status": "failed", "error": "WebhookGuard Quality Gate Failed..." }`.

### GitHub Actions Workflow
The workflow is located at `.github/workflows/webhookguard-ci.yml`.

It performs:
1. **Repository Checkout & Setup**: Node.js 22 environment.
2. **Type Checking & Builds**: Runs `npm run build` on both backend and frontend.
3. **Automated Unit & Integration Tests**: Runs `npm test` covering HMAC, Mock Receiver, Test Runner, and Quality Gate APIs.
4. **Local Quality Gate Validation**: Spins up background instance and verifies rejection (`HTTP 422`) on failing suites.
5. **Remote Quality Gate Integration (Optional)**: If `WEBHOOKGUARD_BASE_URL`, `WEBHOOKGUARD_ENDPOINT_ID`, and `WEBHOOKGUARD_SUITE_ID` are configured in GitHub Actions secrets, it calls the remote quality gate API.

#### Required GitHub Secrets for Remote Deployment
- `WEBHOOKGUARD_BASE_URL`: Public or reachable WebhookGuard API URL (e.g. `https://api.webhookguard.example.com`).
- `WEBHOOKGUARD_ENDPOINT_ID`: Target webhook endpoint ID.
- `WEBHOOKGUARD_SUITE_ID`: Test suite ID to validate prior to release.
- `WEBHOOKGUARD_API_KEY`: Optional API key if external authentication is enabled.

> [!IMPORTANT]
> Hosted GitHub Actions runners cannot reach `http://localhost:4000` on your personal machine. For remote quality gates, configure a publicly accessible staging URL or use a self-hosted runner.

---

## 10. Automated Tests & Verification

Execute the complete test suite locally:

```bash
# Run all automated tests (HMAC, Mock Receiver, Runner, Quality Gate):
npm test

# Build backend and frontend:
npm run build
```

### Verified Test Coverage:
- **HMAC Unit Tests** (`backend/src/tests/hmac.test.ts`): 9/9 passing
- **Mock Receiver Integration Tests** (`backend/src/tests/mockReceiver.test.ts`): 10/10 passing
- **Test Runner & Assertion Tests** (`backend/src/tests/testRunner.test.ts`): 6/6 passing
- **CI/CD Quality Gate Tests** (`backend/src/tests/qualityGate.test.ts`): 4/4 passing
- **Total**: 29/29 tests passing

---

## 11. Security Precautions & Known Limitations

1. **SSRF Protection**: Outbound requests strictly forbid private cloud metadata addresses (`169.254.169.254`, `metadata.google.internal`, etc.). Local addresses (`localhost`, `127.0.0.1`) are permitted exclusively in development for testing the built-in mock receivers.
2. **Timeout Enforcement**: The test runner enforces total execution deadlines via `AbortController`, preventing slow connection hangs during response-body streaming.
3. **Secret Masking**: Shared secrets and tokens are masked with bullet characters (`••••••••`) before persisting or returning request headers in API responses.
4. **Pre-Production Notice**: The platform is configured for local evaluation and automated CI/CD pipeline integration. Review firewall and authentication controls prior to exposing the management dashboard publicly.
