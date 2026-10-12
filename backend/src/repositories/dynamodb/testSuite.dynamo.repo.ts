import { randomUUID } from 'node:crypto';
import {
  PutCommand,
  GetCommand,
  ScanCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES } from './dynamoClient.js';
import { ITestSuiteRepository } from '../interfaces/ITestSuiteRepository.js';
import { TestSuite, TestSuiteCreateDTO, TestSuiteUpdateDTO } from '../../models/types.js';

export class DynamoDbTestSuiteRepository implements ITestSuiteRepository {
  private mapItem(item: any): TestSuite {
    return {
      id: item.id,
      endpointId: item.endpointId,
      name: item.name,
      description: item.description || undefined,
      tests: item.tests || [],
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  async create(data: TestSuiteCreateDTO): Promise<TestSuite> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const item = {
      id,
      endpointId: data.endpointId,
      name: data.name,
      description: data.description || null,
      tests: data.tests || [],
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.testSuites,
        Item: item,
      })
    );

    return this.mapItem(item);
  }

  async findById(id: string): Promise<TestSuite | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.testSuites,
        Key: { id },
      })
    );

    if (!res.Item) return null;
    return this.mapItem(res.Item);
  }

  async findByEndpointId(endpointId: string): Promise<TestSuite[]> {
    try {
      const res = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAMES.testSuites,
          IndexName: 'EndpointIndex',
          KeyConditionExpression: 'endpointId = :ep',
          ExpressionAttributeValues: {
            ':ep': endpointId,
          },
        })
      );
      return (res.Items || []).map((item) => this.mapItem(item));
    } catch {
      // Fallback scan if GSI is indexing or not queried
      const res = await docClient.send(
        new ScanCommand({
          TableName: TABLE_NAMES.testSuites,
          FilterExpression: 'endpointId = :ep',
          ExpressionAttributeValues: {
            ':ep': endpointId,
          },
        })
      );
      return (res.Items || []).map((item) => this.mapItem(item));
    }
  }

  async findAll(): Promise<TestSuite[]> {
    const res = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAMES.testSuites,
      })
    );

    const items = (res.Items || []).map((item) => this.mapItem(item));
    return items.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  }

  async update(id: string, data: TestSuiteUpdateDTO): Promise<TestSuite | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const name = data.name ?? existing.name;
    const description = data.description !== undefined ? data.description : (existing.description || null);
    const tests = data.tests ?? existing.tests;

    const updatedItem = {
      id,
      endpointId: existing.endpointId,
      name,
      description,
      tests,
      createdAt: existing.createdAt,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.testSuites,
        Item: updatedItem,
      })
    );

    return this.mapItem(updatedItem);
  }

  async delete(id: string): Promise<boolean> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAMES.testSuites,
        Key: { id },
      })
    );
    return true;
  }

  async count(): Promise<number> {
    const res = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAMES.testSuites,
        Select: 'COUNT',
      })
    );
    return res.Count || 0;
  }
}
