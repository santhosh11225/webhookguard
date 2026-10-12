import { IEndpointRepository } from '../repositories/interfaces/IEndpointRepository.js';
import { ITestSuiteRepository } from '../repositories/interfaces/ITestSuiteRepository.js';
import { ITestRunRepository } from '../repositories/interfaces/ITestRunRepository.js';
import { ITestResultRepository } from '../repositories/interfaces/ITestResultRepository.js';
import { DashboardAnalytics } from '../models/types.js';

export class AnalyticsService {
  constructor(
    private endpointRepo: IEndpointRepository,
    private suiteRepo: ITestSuiteRepository,
    private runRepo: ITestRunRepository,
    private resultRepo: ITestResultRepository
  ) {}

  async getDashboardAnalytics(): Promise<DashboardAnalytics> {
    const totalEndpoints = await this.endpointRepo.count();
    const totalSuites = await this.suiteRepo.count();
    const aggregate = await this.runRepo.getAggregateStats();
    const recentRuns = await this.runRepo.findAll(10);
    const globalMetrics = await this.resultRepo.getGlobalMetrics();

    const successRate =
      aggregate.totalTests > 0
        ? Math.round((aggregate.passedTests / aggregate.totalTests) * 1000) / 10
        : 0;

    // Generate trend metrics from recent runs
    const successRateTrends = recentRuns
      .slice(0, 7)
      .reverse()
      .map((r, idx) => ({
        date: new Date(r.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        successRate: r.totalTests > 0 ? Math.round((r.passed / r.totalTests) * 100) : 0,
        total: r.totalTests,
      }));

    const responseTimesOverTime = recentRuns
      .slice(0, 10)
      .reverse()
      .map((r) => ({
        timestamp: new Date(r.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        avgTime: r.totalTests > 0 && r.durationMs !== undefined ? Math.round(r.durationMs / r.totalTests) : 0,
      }));

    return {
      totalEndpoints,
      totalSuites,
      totalTests: aggregate.totalTests,
      passedTests: aggregate.passedTests,
      failedTests: aggregate.failedTests,
      successRate,
      avgResponseTime: globalMetrics.avgResponseTime ?? 0,
      recentRuns,
      statusDistribution: globalMetrics.statusDistribution,
      responseTimesOverTime,
      successRateTrends,
      securityFailureCount: globalMetrics.securityFailures,
      timeoutCount: globalMetrics.timeoutFailures,
      retryCount: globalMetrics.retryCount,
    };
  }
}
