import { ITestSuiteRepository } from '../repositories/interfaces/ITestSuiteRepository.js';
import { IEndpointRepository } from '../repositories/interfaces/IEndpointRepository.js';
import { TestSuite, TestSuiteCreateDTO, TestSuiteUpdateDTO } from '../models/types.js';

export class TestSuiteService {
  constructor(
    private suiteRepo: ITestSuiteRepository,
    private endpointRepo: IEndpointRepository
  ) {}

  async create(data: TestSuiteCreateDTO): Promise<TestSuite> {
    if (!data.name || !data.name.trim()) {
      throw new Error('Test suite name is required');
    }
    const endpoint = await this.endpointRepo.findById(data.endpointId);
    if (!endpoint) {
      throw new Error(`Endpoint not found: ${data.endpointId}`);
    }

    return this.suiteRepo.create(data);
  }

  async findById(id: string): Promise<TestSuite | null> {
    return this.suiteRepo.findById(id);
  }

  async findByEndpointId(endpointId: string): Promise<TestSuite[]> {
    return this.suiteRepo.findByEndpointId(endpointId);
  }

  async findAll(): Promise<TestSuite[]> {
    return this.suiteRepo.findAll();
  }

  async update(id: string, data: TestSuiteUpdateDTO): Promise<TestSuite | null> {
    return this.suiteRepo.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return this.suiteRepo.delete(id);
  }
}
