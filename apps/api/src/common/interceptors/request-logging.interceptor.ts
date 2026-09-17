import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from '../../modules/common/metrics.service';

type AuthedRequest = Request & {
  user?: { id?: string };
  correlationId?: string;
};

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<AuthedRequest>();
    const res = http.getResponse<Response>();
    const correlationId =
      (req.headers['x-request-id'] as string | undefined) ||
      (req.headers['x-correlation-id'] as string | undefined) ||
      randomUUID();
    req.correlationId = correlationId;
    res.setHeader('x-request-id', correlationId);

    const started = Date.now();
    const method = req.method;
    const routePath =
      req.route && typeof req.route === 'object' && 'path' in req.route
        ? String((req.route as { path: unknown }).path)
        : null;
    const route =
      routePath != null ? `${req.baseUrl || ''}${routePath}` : req.path;

    return next.handle().pipe(
      tap({
        next: () => {
          this.writeLog(
            req,
            method,
            route,
            res.statusCode,
            started,
            correlationId,
          );
        },
        error: (err: { status?: number; statusCode?: number }) => {
          const status =
            err?.status ?? err?.statusCode ?? res.statusCode ?? 500;
          this.writeLog(req, method, route, status, started, correlationId);
        },
      }),
    );
  }

  private writeLog(
    req: AuthedRequest,
    method: string,
    route: string,
    statusCode: number,
    started: number,
    correlationId: string,
  ) {
    const durationMs = Date.now() - started;
    this.metrics.recordRequest({ method, route, statusCode, durationMs });

    // Structured single-line JSON for production log aggregation.
    const payload = {
      timestamp: new Date().toISOString(),
      level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
      msg: 'request',
      requestId: correlationId,
      method,
      route,
      path: req.path,
      status: statusCode,
      durationMs,
      userId: req.user?.id ?? null,
    };
    this.logger.log(JSON.stringify(payload));
  }
}
