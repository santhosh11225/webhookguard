import { randomUUID } from 'node:crypto';
import {
  PutCommand,
  GetCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES } from './dynamoClient.js';
import { ITestResultRepository } from '../interfaces/ITestResultRepository.js';
import { TestResult } from '../../models/types.js';

export class DynamoDbTestResultRepository implements ITestResultRepository {
  private mapItem(item: any): TestResult {
    return {
      id: item.id,
      runId: item.runId,
      testId: item.testId || undefined,
      testName: item.testName,
      testType: item.testType,
      status: item.status,
      expectedStatus: item.expectedStatus,
      actualStatus: item.actualStatus !== undefined ? item.actualStatus : undefined,
      responseTime: item.responseTime || 0,
      error: item.error || undefined,
      request: item.request || { url: '', method: 'POST', headers: {} },
      response: item.response || undefined,
      retryCount: item.retryCount || 0,
      attempts: item.attempts || undefined,
      securityDetails: item.securityDetails || undefined,
      timestamp: item.timestamp,
    };
  }

  async create(data: Omit<TestResult, 'id'>): Promise<TestResult> {
    const id = randomUUID();
    const item = {
      id,
      ...data,
      actualStatus: data.actualStatus ?? null,
      error: data.error ?? null,
      response: data.response ?? null,
      attempts: data.attempts ?? null,
      securityDetails: data.securityDetails ?? null,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.testResults,
        Item: item,
      })
    );

    return this.mapItem(item);
  }

  async createMany(items: Omit<TestResult, 'id'>[]): Promise<TestResult[]> {
    const results: TestResult[] = [];
    for (const item of items) {
      results.push(await this.create(item));
    }
    return results;
  }

  async findById(id: string): Promise<TestResult | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.testResults,
        Key: { id },
      })
    );

    if (!res.Item) return null;
    return this.mapItem(res.Item);
  }

  async findByRunId(runId: string): Promise<TestResult[]> {
    const res = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAMES.testResults,
        FilterExpression: 'runId = :r',
        ExpressionAttributeValues: { ':r': runId },
      })
    );

    const items = (res.Items || []).map((item) => this.mapItem(item));
    return items.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
  }

  async getMetricsByRunId(runId: string): Promise<{
    total: number;
    passed: number;
    failed: number;
    avgResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    securityFailures: number;
    timeoutFailures: number;
    retryFailures: number;
    statusDistribution: Record<string, number>;
  }> {
    const results = await this.findByRunId(runId);
    if (results.length === 0) {
      return {
        total: 0,
        passed: 0,
        failed: 0,
        avgResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        securityFailures: 0,
        timeoutFailures: 0,
        retryFailures: 0,
        statusDistribution: {},
      };
    }

    let passed = 0;
    let failed = 0;
    let securityFailures = 0;
    let timeoutFailures = 0;
    let retryFailures = 0;
    let totalTime = 0;
    let minTime = Infinity;
    let maxTime = 0;
    const statusDistribution: Record<string, number> = {};

    for (const res of results) {
      if (res.status === 'PASS') passed++;
      else failed++;

      if (res.status === 'SECURITY FAILURE') securityFailures++;
      if (res.status === 'TIMEOUT') timeoutFailures++;
      if (res.retryCount > 0 && res.status !== 'PASS') retryFailures++;

      totalTime += res.responseTime;
      if (res.responseTime < minTime) minTime = res.responseTime;
      if (res.responseTime > maxTime) maxTime = res.responseTime;

      const code = res.actualStatus ? `${res.actualStatus}` : (res.status === 'TIMEOUT' ? 'Timeout' : 'Error');
      statusDistribution[code] = (statusDistribution[code] || 0) + 1;
    }

    return {
      total: results.length,
      passed,
      failed,
      avgResponseTime: Math.round(totalTime / results.length),
      minResponseTime: minTime === Infinity ? 0 : Math.round(minTime),
      maxResponseTime: Math.round(maxTime),
      securityFailures,
      timeoutFailures,
      retryFailures,
      statusDistribution,
    };
  }

  async getGlobalMetrics(): Promise<{
    avgResponseTime: number;
    securityFailures: number;
    timeoutFailures: number;
    retryCount: number;
    statusDistribution: { status: string; count: number }[];
  }> {
    const res = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAMES.testResults,
      })
    );

    const items = (res.Items || []).map((item) => this.mapItem(item));
    let totalTime = 0;
    let securityFailures = 0;
    let timeoutFailures = 0;
    let retryCount = 0;
    const distMap: Record<string, number> = {};

    for (const item of items) {
      totalTime += item.responseTime || 0;
      if (item.status === 'SECURITY FAILURE') securityFailures++;
      if (item.status === 'TIMEOUT') timeoutFailures++;
      if (item.retryCount > 0) retryCount++;

      const statusKey = item.actualStatus ? String(item.actualStatus) : (item.status === 'TIMEOUT' ? 'TIMEOUT' : 'ERROR');
      distMap[statusKey] = (distMap[statusKey] || 0) + 1;
    }

    const statusDistribution = Object.entries(distMap).map(([status, count]) => ({
      status,
      count,
    }));

    return {
      avgResponseTime: items.length > 0 ? Math.round(totalTime / items.length) : 0,
      securityFailures,
      timeoutFailures,
      retryCount,
      statusDistribution,
    };
  }
}
