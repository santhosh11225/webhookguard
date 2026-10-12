import { ITestRunRepository } from '../repositories/interfaces/ITestRunRepository.js';
import { ITestResultRepository } from '../repositories/interfaces/ITestResultRepository.js';
import { IEndpointRepository } from '../repositories/interfaces/IEndpointRepository.js';
import { ITestSuiteRepository } from '../repositories/interfaces/ITestSuiteRepository.js';
import { ReportSummary } from '../models/types.js';

export class ReportService {
  constructor(
    private runRepo: ITestRunRepository,
    private resultRepo: ITestResultRepository,
    private endpointRepo: IEndpointRepository,
    private suiteRepo: ITestSuiteRepository
  ) {}

  async generateRunReport(runId: string): Promise<ReportSummary> {
    const run = await this.runRepo.findById(runId);
    if (!run) {
      throw new Error(`Test Run not found: ${runId}`);
    }

    const endpoint = await this.endpointRepo.findById(run.endpointId);
    if (!endpoint) {
      throw new Error(`Endpoint not found: ${run.endpointId}`);
    }

    const suite = await this.suiteRepo.findById(run.suiteId);
    if (!suite) {
      throw new Error(`Test Suite not found: ${run.suiteId}`);
    }

    const results = await this.resultRepo.findByRunId(runId);
    const metrics = await this.resultRepo.getMetricsByRunId(runId);

    const successRate =
      metrics.total > 0 ? Math.round((metrics.passed / metrics.total) * 1000) / 10 : 0;

    return {
      run,
      endpoint,
      suite,
      results,
      metrics: {
        total: metrics.total,
        passed: metrics.passed,
        failed: metrics.failed,
        successRate,
        avgResponseTime: metrics.avgResponseTime,
        minResponseTime: metrics.minResponseTime,
        maxResponseTime: metrics.maxResponseTime,
        securityFailures: metrics.securityFailures,
        timeoutFailures: metrics.timeoutFailures,
        retryFailures: metrics.retryFailures,
      },
      statusDistribution: metrics.statusDistribution,
    };
  }
}
