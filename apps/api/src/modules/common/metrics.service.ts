import { Injectable } from '@nestjs/common';

type Counters = {
  requestsTotal: number;
  requests5xx: number;
  requestDurationMsSum: number;
  byRoute: Record<string, { count: number; errors5xx: number }>;
};

/**
 * In-process metrics baseline (no vendor lock-in).
 * Suitable for scraping via authenticated /metrics endpoint.
 */
@Injectable()
export class MetricsService {
  private readonly startedAt = new Date();
  private counters: Counters = {
    requestsTotal: 0,
    requests5xx: 0,
    requestDurationMsSum: 0,
    byRoute: {},
  };

  recordRequest(input: {
    method: string;
    route: string;
    statusCode: number;
    durationMs: number;
  }) {
    this.counters.requestsTotal += 1;
    this.counters.requestDurationMsSum += input.durationMs;
    if (input.statusCode >= 500) {
      this.counters.requests5xx += 1;
    }
    const key = `${input.method} ${input.route}`;
    const bucket = this.counters.byRoute[key] ?? { count: 0, errors5xx: 0 };
    bucket.count += 1;
    if (input.statusCode >= 500) bucket.errors5xx += 1;
    this.counters.byRoute[key] = bucket;
  }

  snapshot() {
    const avg =
      this.counters.requestsTotal === 0
        ? 0
        : this.counters.requestDurationMsSum / this.counters.requestsTotal;
    return {
      service: 'fbm-api',
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startedAt.getTime()) / 1000),
      requestsTotal: this.counters.requestsTotal,
      requests5xx: this.counters.requests5xx,
      averageDurationMs: Number(avg.toFixed(2)),
      routes: this.counters.byRoute,
    };
  }
}
