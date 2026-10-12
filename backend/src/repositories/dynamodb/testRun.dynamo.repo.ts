import { randomUUID } from 'node:crypto';
import {
  PutCommand,
  GetCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES } from './dynamoClient.js';
import { ITestRunRepository, TestRunCreateData } from '../interfaces/ITestRunRepository.js';
import { TestRun } from '../../models/types.js';

export class DynamoDbTestRunRepository implements ITestRunRepository {
  private mapItem(item: any): TestRun {
    return {
      id: item.id,
      endpointId: item.endpointId,
      suiteId: item.suiteId,
      status: item.status,
      totalTests: item.totalTests || 0,
      passed: item.passed || 0,
      failed: item.failed || 0,
      startedAt: item.startedAt,
      completedAt: item.completedAt || undefined,
      durationMs: item.durationMs || undefined,
      trigger: item.trigger || 'manual',
      environment: item.environment || undefined,
      endpointName: item.endpointName || undefined,
      suiteName: item.suiteName || undefined,
    };
  }

  async create(data: TestRunCreateData): Promise<TestRun> {
    const id = randomUUID();
    const item = {
      id,
      endpointId: data.endpointId,
      suiteId: data.suiteId,
      status: data.status,
      totalTests: data.totalTests || 0,
      passed: data.passed || 0,
      failed: data.failed || 0,
      startedAt: data.startedAt,
      completedAt: data.completedAt || null,
      durationMs: data.durationMs || null,
      trigger: data.trigger || 'manual',
      environment: data.environment || null,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.testRuns,
        Item: item,
      })
    );

    return this.mapItem(item);
  }

  async findById(id: string): Promise<TestRun | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.testRuns,
        Key: { id },
      })
    );

    if (!res.Item) return null;
    return this.mapItem(res.Item);
  }

  async findByEndpointId(endpointId: string): Promise<TestRun[]> {
    const res = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAMES.testRuns,
        FilterExpression: 'endpointId = :ep',
        ExpressionAttributeValues: { ':ep': endpointId },
      })
    );

    const items = (res.Items || []).map((item) => this.mapItem(item));
    return items.sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1));
  }

  async findBySuiteId(suiteId: string): Promise<TestRun[]> {
    const res = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAMES.testRuns,
        FilterExpression: 'suiteId = :st',
        ExpressionAttributeValues: { ':st': suiteId },
      })
    );

    const items = (res.Items || []).map((item) => this.mapItem(item));
    return items.sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1));
  }

  async findAll(limit = 100): Promise<TestRun[]> {
    const res = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAMES.testRuns,
      })
    );

    const items = (res.Items || []).map((item) => this.mapItem(item));
    return items
      .sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1))
      .slice(0, limit);
  }

  async update(id: string, data: Partial<TestRun>): Promise<TestRun | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updatedItem = {
      ...existing,
      ...data,
      completedAt: data.completedAt !== undefined ? data.completedAt : existing.completedAt,
      durationMs: data.durationMs !== undefined ? data.durationMs : existing.durationMs,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.testRuns,
        Item: updatedItem,
      })
    );

    return this.mapItem(updatedItem);
  }

  async delete(id: string): Promise<boolean> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAMES.testRuns,
        Key: { id },
      })
    );
    return true;
  }

  async count(): Promise<number> {
    const res = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAMES.testRuns,
        Select: 'COUNT',
      })
    );
    return res.Count || 0;
  }

  async getAggregateStats(): Promise<{
    totalRuns: number;
    passedRuns: number;
    failedRuns: number;
    totalTests: number;
    passedTests: number;
    failedTests: number;
  }> {
    const runs = await this.findAll(1000);
    let passedRuns = 0;
    let failedRuns = 0;
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const r of runs) {
      if (r.status === 'passed') passedRuns++;
      else failedRuns++;

      totalTests += r.totalTests || 0;
      passedTests += r.passed || 0;
      failedTests += r.failed || 0;
    }

    return {
      totalRuns: runs.length,
      passedRuns,
      failedRuns,
      totalTests,
      passedTests,
      failedTests,
    };
  }
}
