import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

const SECRET_KEYS = /pass(word)?|pin|token|secret/i;

/** Mask credentials (passwords, gift card PINs, tokens) before request bodies hit the logs. */
function redactSecrets(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([k, v]) => [
      k,
      SECRET_KEYS.test(k) ? '[REDACTED]' : v,
    ]),
  );
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const errorId = uuidv4();
    let status: number;
    let message: string;
    // Extra fields a handler deliberately put on the error (e.g. attemptsRemaining)
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      const httpEx: HttpException = exception;
      status = httpEx.getStatus();
      const resp = httpEx.getResponse() as any;
      message = resp?.message || httpEx.message;
      if (resp && typeof resp === 'object') {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { message: _m, statusCode: _s, error: _e, ...rest } = resp;
        extra = rest;
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    // Log the error with ID and request context
    try {
      const stack = (exception as any)?.stack || null;
      const exceptionData = {
        exception: {
          name: (exception as any)?.name || null,
          message: (exception as any)?.message || null,
          stack,
        },
        body: redactSecrets(req.body),
        params: req.params,
        query: req.query,
      };
      this.logger.error(
        `ErrorID=${errorId} ${req.method} ${req.url} ${message}`,
        JSON.stringify(exceptionData),
      );
    } catch (err) {
      this.logger.error(`Error logging exception: ${err as any}`);
    }

    // Return standard JSON error structure with errorId
    res.status(status).json({
      ...extra,
      statusCode: status,
      errorId,
      message,
    });
  }
}
