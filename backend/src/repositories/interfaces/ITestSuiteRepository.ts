import { TestSuite, TestSuiteCreateDTO, TestSuiteUpdateDTO } from '../../models/types.js';

export interface ITestSuiteRepository {
  create(data: TestSuiteCreateDTO): Promise<TestSuite>;
  findById(id: string): Promise<TestSuite | null>;
  findByEndpointId(endpointId: string): Promise<TestSuite[]>;
  findAll(): Promise<TestSuite[]>;
  update(id: string, data: TestSuiteUpdateDTO): Promise<TestSuite | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
}
