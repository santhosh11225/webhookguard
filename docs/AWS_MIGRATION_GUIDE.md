# Future AWS Migration Architecture Guide

> **Important Notice:**
> Per project specification, **no AWS resources, Lambda functions, API Gateways, DynamoDB tables, or CloudFormation templates have been created**.
> This guide documents how the existing codebase was architected so you can manually connect it to AWS serverless infrastructure in the future without modifying the React frontend or domain business logic.

---

## Architecture Transition Diagram

### Current Local Architecture

```text
React (Vite Frontend)
        ↓  (Standard REST HTTP calls)
Express.js (Node.js API Server)
        ↓  (Service Layer / Dependency Injection)
SQLite Repository Implementation
        ↓
Local SQLite File (data/webhookguard.sqlite)
```

### Future Serverless AWS Architecture

```text
React (Vite Frontend — Hosted on S3 + CloudFront / Amplify)
        ↓  (Exact same REST API contract)
Amazon API Gateway (HTTP / REST API)
        ↓  (Proxy routing or direct endpoint mappings)
AWS Lambda Functions (Node.js runtime executing Service Layer)
        ↓  (IEndpointRepository, ITestSuiteRepository, etc.)
DynamoDbRepository Implementation (@aws-sdk/client-dynamodb)
        ↓
Amazon DynamoDB Tables
```

---

## Why the Migration Requires Zero Frontend Rewrites

1. **Strict REST Contract**: The frontend communicates exclusively with `/api/endpoints`, `/api/test-suites`, `/api/test-runs`, etc., via standard JSON payloads and HTTP status codes. Pointing the frontend to API Gateway is achieved by updating a single environment variable:
   ```env
   VITE_API_URL=https://{api-gateway-id}.execute-api.us-east-1.amazonaws.com/prod
   ```

2. **Decoupled Service Layer**: Business services (`TestRunnerService`, `EndpointService`, `ReportService`, `AnalyticsService`) have zero knowledge of Express, HTTP transports, or SQLite. They can be invoked directly inside AWS Lambda handlers:
   ```typescript
   // Example Lambda Handler for POST /test-runs
   export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
     const body = JSON.parse(event.body || '{}');
     const runner = new TestRunnerService(endpointRepo, suiteRepo, runRepo, resultRepo);
     const result = await runner.executeSuite(body.endpointId, body.suiteId, body.trigger);
     return {
       statusCode: 201,
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(result)
     };
   };
   ```

3. **Repository Interface Swapping**:
   Replace:
   ```typescript
   // backend/src/repositories/sqlite/endpoint.repository.ts
   export class SqliteEndpointRepository implements IEndpointRepository { ... }
   ```
   With:
   ```typescript
   // backend/src/repositories/dynamodb/endpoint.repository.ts
   export class DynamoDbEndpointRepository implements IEndpointRepository { ... }
   ```
   Because both implement `IEndpointRepository`, the service logic never changes.

---

## Suggested DynamoDB Schema Design

| Table Name | Partition Key (`PK`) | Sort Key (`SK`) | Attributes |
| :--- | :--- | :--- | :--- |
| `Endpoints` | `ENDPOINT#<id>` | `METADATA` | `name`, `url`, `method`, `authentication`, `secret`, `headers`, `environment` |
| `TestSuites` | `ENDPOINT#<endpointId>` | `SUITE#<suiteId>` | `name`, `description`, `tests` (JSON) |
| `TestRuns` | `RUN#<runId>` | `SUMMARY` | `endpointId`, `suiteId`, `status`, `passed`, `failed`, `durationMs`, `startedAt` |
| `TestResults`| `RUN#<runId>` | `RESULT#<resultId>` | `testName`, `status`, `actualStatus`, `expectedStatus`, `request`, `response`, `attempts` |

---

## Monitoring and Observability
The `AnalyticsService` currently writes execution events to the database and aggregates latency and error distributions. In AWS, this service can easily emit custom **Amazon CloudWatch Metrics**:
- Metric: `WebhookExecutionLatency` (Unit: `Milliseconds`)
- Metric: `SecurityFailureCount` (Unit: `Count`)
- Metric: `TimeoutCount` (Unit: `Count`)
- Metric: `RetryAttemptCount` (Unit: `Count`)
