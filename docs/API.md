# WebhookGuard REST API Reference

Base URL: `http://localhost:4000/api`

---

## 1. Health

### `GET /health`
Returns system status, service uptime, and demo mode configuration.

#### Response `200 OK`
```json
{
  "status": "healthy",
  "timestamp": "2026-09-17T08:09:20.285Z",
  "service": "WebhookGuard API Engine",
  "version": "1.0.0",
  "uptime": 124.5,
  "demoMode": false
}
```

---

## 2. Endpoints

### `GET /endpoints`
Lists all registered webhook endpoints.

### `POST /endpoints`
Registers a new webhook endpoint.

#### Request Body
```json
{
  "name": "Stripe Payment Webhook",
  "url": "http://localhost:4000/api/mock-webhooks/payment",
  "method": "POST",
  "authentication": "hmac",
  "secret": "whsec_test_secret_key",
  "headers": {
    "X-Signature-Header": "X-Signature"
  },
  "environment": "production"
}
```

### `GET /endpoints/:id`
Fetch endpoint details (secret masked).

### `PUT /endpoints/:id`
Update an existing endpoint.

### `DELETE /endpoints/:id`
Deletes an endpoint and cascades to its test suites.

---

## 3. Test Suites

### `GET /test-suites?endpointId={id}`
Lists test suites, optionally filtered by endpoint.

### `POST /test-suites`
Creates a new test suite with test scenarios.

#### Request Body
```json
{
  "endpointId": "uuid-here",
  "name": "Core Payment Reliability Suite",
  "description": "Validates payment events, HMAC signatures, and timeouts",
  "tests": [
    {
      "id": "test-valid",
      "name": "Valid Payment Payload",
      "type": "valid",
      "method": "POST",
      "expectedStatus": 200,
      "payload": {
        "event": "payment.success",
        "transaction_id": "txn_1028",
        "amount": 4999
      },
      "timeoutMs": 5000,
      "retryCount": 1
    },
    {
      "id": "test-invalid-hmac",
      "name": "Invalid HMAC Signature Audit",
      "type": "invalid_hmac",
      "method": "POST",
      "expectedStatus": 401,
      "payload": {
        "event": "payment.success"
      },
      "timeoutMs": 5000,
      "retryCount": 1
    }
  ]
}
```

---

## 4. Test Runs (CI/CD Quality Gate)

### `POST /test-runs`
Executes real HTTP requests against the webhook target for each test in the suite.

#### Query Parameters
- `failOnErrors=true`: If set and any test fails, returns HTTP `422 Unprocessable Entity` to fail CI/CD build steps.

#### Request Body
```json
{
  "endpointId": "uuid-here",
  "suiteId": "uuid-here",
  "trigger": "cicd"
}
```

#### Response `201 Created` (Pass)
```json
{
  "success": true,
  "runId": "a8f7f316-run-1028",
  "status": "passed",
  "total": 10,
  "passed": 10,
  "failed": 0,
  "durationMs": 1420
}
```

#### Response `422 Unprocessable Entity` (Failure when failOnErrors=true)
```json
{
  "success": false,
  "runId": "a8f7f316-run-1029",
  "status": "failed",
  "total": 10,
  "passed": 8,
  "failed": 2,
  "error": "WebhookGuard Quality Gate Failed: 2 out of 10 tests failed"
}
```

### `GET /test-runs`
Lists historical test runs.

### `GET /test-runs/:id`
Retrieves execution status for a specific test run.

---

## 5. Test Results

### `GET /test-results/:runId`
Retrieves granular scenario results including request headers, outgoing payload, response body, latency, and retry timelines.

---

## 6. Reports

### `GET /reports/:runId`
Returns an executive summary report with pass/fail ratios, security alerts, timeout breaches, and HTTP status distribution.

---

## 7. Analytics

### `GET /analytics/dashboard`
Returns high-level platform statistics, latency percentiles, recent executions, and reliability trends.

---

## 8. Built-in Mock Webhook Targets

### `ALL /mock-webhooks/payment`
Live mock endpoint that verifies HMAC-SHA256 signatures, checks required fields (`transaction_id`, `amount`), and validates payload structures. Supports `?delay=ms` query parameter.

### `ALL /mock-webhooks/orders`
Live mock endpoint that simulates transient 503 failures across retries before returning 200 OK.
