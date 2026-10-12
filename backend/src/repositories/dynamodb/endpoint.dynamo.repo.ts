import { randomUUID } from 'node:crypto';
import {
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAMES } from './dynamoClient.js';
import { IEndpointRepository } from '../interfaces/IEndpointRepository.js';
import { Endpoint, EndpointCreateDTO, EndpointUpdateDTO } from '../../models/types.js';

export class DynamoDbEndpointRepository implements IEndpointRepository {
  private mapItem(item: any, maskSecret = true): Endpoint {
    return {
      id: item.id,
      name: item.name,
      url: item.url,
      method: item.method || 'POST',
      authentication: item.authentication || 'none',
      secret: item.secret ? (maskSecret ? '••••••••' : item.secret) : undefined,
      headers: item.headers || {},
      environment: item.environment || 'development',
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  async create(data: EndpointCreateDTO): Promise<Endpoint> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const item = {
      id,
      name: data.name,
      url: data.url,
      method: data.method || 'POST',
      authentication: data.authentication || 'none',
      secret: data.secret || null,
      headers: data.headers || {},
      environment: data.environment || 'development',
      createdAt: now,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.endpoints,
        Item: item,
      })
    );

    return this.mapItem(item, true);
  }

  async findById(id: string, maskSecret = true): Promise<Endpoint | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.endpoints,
        Key: { id },
      })
    );

    if (!res.Item) return null;
    return this.mapItem(res.Item, maskSecret);
  }

  async findByIdWithSecret(id: string): Promise<Endpoint | null> {
    return this.findById(id, false);
  }

  async findAll(): Promise<Endpoint[]> {
    const res = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAMES.endpoints,
      })
    );

    const items = (res.Items || []).map((item) => this.mapItem(item, true));
    // Sort newest first
    return items.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  }

  async update(id: string, data: EndpointUpdateDTO): Promise<Endpoint | null> {
    const existing = await this.findById(id, false);
    if (!existing) return null;

    const now = new Date().toISOString();
    const name = data.name ?? existing.name;
    const url = data.url ?? existing.url;
    const method = data.method ?? existing.method;
    const authentication = data.authentication ?? existing.authentication;
    let secret = existing.secret;
    if (data.secret !== undefined) {
      if (!data.secret.startsWith('•••') && data.secret !== '') {
        secret = data.secret;
      }
    }
    const headers = data.headers ?? existing.headers;
    const environment = data.environment ?? existing.environment;

    const updatedItem = {
      id,
      name,
      url,
      method,
      authentication,
      secret: secret ?? null,
      headers,
      environment,
      createdAt: existing.createdAt,
      updatedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.endpoints,
        Item: updatedItem,
      })
    );

    return this.mapItem(updatedItem, true);
  }

  async delete(id: string): Promise<boolean> {
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAMES.endpoints,
        Key: { id },
      })
    );
    return true;
  }

  async count(): Promise<number> {
    const res = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAMES.endpoints,
        Select: 'COUNT',
      })
    );
    return res.Count || 0;
  }
}
