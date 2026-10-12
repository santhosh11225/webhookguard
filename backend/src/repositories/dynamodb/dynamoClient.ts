import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-2';

const rawClient = new DynamoDBClient({ region });

export const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

export const TABLE_NAMES = {
  endpoints: process.env.ENDPOINTS_TABLE || 'WebhookGuard-Endpoints',
  testSuites: process.env.SUITES_TABLE || 'WebhookGuard-TestSuites',
  testRuns: process.env.RUNS_TABLE || 'WebhookGuard-TestRuns',
  testResults: process.env.RESULTS_TABLE || 'WebhookGuard-TestResults',
};
