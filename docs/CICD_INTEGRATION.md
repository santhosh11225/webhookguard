# WebhookGuard CI/CD Pipeline Integration Guide

## Overview

WebhookGuard exposes a dedicated quality gate endpoint designed to run in continuous integration pipelines such as **GitHub Actions**, **GitLab CI**, or **Jenkins**.

When `failOnErrors=true` is appended to `POST /api/test-runs`, the API returns **HTTP 422 Unprocessable Entity** if any assertion, timeout check, or security test fails. This causes the CI runner to exit with a non-zero exit code, immediately blocking broken or insecure webhook implementations from merging or deploying.

---

## 1. GitHub Actions Workflow

Create a new file `.github/workflows/webhook-quality-gate.yml` in your repository:

```yaml
name: WebhookGuard Quality Gate

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
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Run WebhookGuard Quality Gate
        id: webhook_gate
        run: |
          echo "Triggering WebhookGuard test suite..."

          # Replace ENDPOINT_ID and SUITE_ID with your configured IDs
          ENDPOINT_ID="${{ secrets.WEBHOOKGUARD_ENDPOINT_ID }}"
          SUITE_ID="${{ secrets.WEBHOOKGUARD_SUITE_ID }}"
          API_URL="${{ secrets.WEBHOOKGUARD_API_URL || 'http://localhost:4000/api' }}"

          HTTP_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
            "$API_URL/test-runs?failOnErrors=true" \
            -H "Content-Type: application/json" \
            -d "{
              \"endpointId\": \"$ENDPOINT_ID\",
              \"suiteId\": \"$SUITE_ID\",
              \"trigger\": \"cicd\"
            }")

          HTTP_CODE=$(echo "$HTTP_RESPONSE" | tail -n1)
          RESPONSE_BODY=$(echo "$HTTP_RESPONSE" | sed '$d')

          echo "Response Body:"
          echo "$RESPONSE_BODY"

          if [ "$HTTP_CODE" -ne 201 ]; then
            echo "::error::WebhookGuard Quality Gate Failed! (HTTP $HTTP_CODE)"
            exit 1
          fi

          echo "All webhook test assertions passed successfully!"
```

---

## 2. cURL Example for Any Pipeline Script

```bash
# Execute test run with quality gate enforcement
curl -i -X POST "http://localhost:4000/api/test-runs?failOnErrors=true" \
  -H "Content-Type: application/json" \
  -d '{
    "endpointId": "your-endpoint-uuid",
    "suiteId": "your-suite-uuid",
    "trigger": "cicd"
  }'
```

If any test fails, cURL receives HTTP 422:
```json
{
  "success": false,
  "runId": "65b90f42-...",
  "status": "failed",
  "total": 10,
  "passed": 8,
  "failed": 2,
  "error": "WebhookGuard Quality Gate Failed: 2 out of 10 tests failed"
}
```
