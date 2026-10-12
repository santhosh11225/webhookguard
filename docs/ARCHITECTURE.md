# WebhookGuard Architecture Specification

## Overview

WebhookGuard is built using a strict layered architecture pattern. The separation of concerns ensures that business logic, execution routines, and user interfaces remain decoupled from database implementations and hosting environments.

```text
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)              │
│       - Modern Developer UI (Tailwind CSS, Lucide)      │
│       - State Management, Toast Notifications           │
│       - Telemetry Visualizations (Recharts)             │
└────────────────────────────┬────────────────────────────┘
                             │ HTTP / JSON REST API
                             ▼
┌─────────────────────────────────────────────────────────┐
│                      REST API Layer                     │
│       - Express Routes & Controllers                    │
│       - Request DTO Validation & Error Middleware       │
│       - CORS Configuration & Parameter Extraction       │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                      Service Layer                      │
│       - TestRunnerService (Real HTTP Engine)            │
│       - EndpointService (URL & Config Validation)       │
│       - TestSuiteService (Template Management)          │
│       - ReportService (Audit Metrics Aggregation)       │
│       - AnalyticsService (SLA Trends & Status Dist)     │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                 Repository Interfaces                   │
│       - IEndpointRepository                             │
│       - ITestSuiteRepository                            │
│       - ITestRunRepository                              │
│       - ITestResultRepository                           │
└────────────────────────────┬────────────────────────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [Current Local Storage]          [Future Migration Path]
      SQLite Database                 AWS DynamoDB Tables
  (better-sqlite3 / node:sqlite)       (No Frontend Changes)
```

---

## Key Architectural Principles

### 1. Abstracted Repository Pattern
All database interactions are defined through TypeScript interfaces:
- `IEndpointRepository` (`create`, `findById`, `findAll`, `update`, `delete`, `count`)
- `ITestSuiteRepository` (`create`, `findById`, `findByEndpointId`, `findAll`, `update`, `delete`, `count`)
- `ITestRunRepository` (`create`, `findById`, `findByEndpointId`, `findBySuiteId`, `findAll`, `update`, `getAggregateStats`)
- `ITestResultRepository` (`create`, `createMany`, `findByRunId`, `findById`, `getMetricsByRunId`, `getGlobalMetrics`)

Neither the Express controllers nor the service classes issue direct SQL queries. When migrating to AWS DynamoDB in the future, developers implement `DynamoDbEndpointRepository`, `DynamoDbTestSuiteRepository`, etc., conforming to these interfaces. The rest of the application remains unchanged.

### 2. Real HTTP Execution Engine
The `TestRunnerService` performs real network requests to configured webhook endpoints using Node's native `fetch` client:
- **High-Resolution Latency**: Calculated using `performance.now()`.
- **HMAC-SHA256 Signing**: Automatically computes hex digest using shared secrets and injects `X-Signature` or custom headers.
- **Negative Security Audits**: Intentionally alters signatures or omits tokens to assert whether the endpoint enforces authentication.
- **Timeout Protection**: Strict `AbortController` aborts hanging requests when SLA deadlines are exceeded.
- **Retry State Machine**: Loops across transient errors (HTTP 500/503), logging every attempt.

### 3. Built-in Mock Webhook Target
To provide instant zero-setup testing on localhost, the backend exposes:
- `/api/mock-webhooks/payment`: Verifies HMAC signatures, required transaction fields, and supports simulated latency (`?delay=3000`).
- `/api/mock-webhooks/orders`: Implements an in-memory retry simulation (fails with 503 twice, then recovers with 200).
- `/api/mock-webhooks/payment?vulnerable=true`: Simulates an insecure handler that mistakenly accepts invalid HMAC signatures to demonstrate the **`SECURITY FAILURE`** alert.
