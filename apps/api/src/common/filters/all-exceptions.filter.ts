import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface PrismaLikeError {
  code?: string;
  meta?: Record<string, unknown>;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'An unexpected error occurred';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const typed = body as {
          message?: string | string[];
          error?: string;
          details?: unknown;
        };
        message = typed.message ?? exception.message;
        error = typed.error ?? exception.name;
        if (typed.details !== undefined) {
          response.status(status).json({
            statusCode: status,
            message,
            error,
            details: typed.details,
            path: request.originalUrl,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }
    } else {
      const prismaError = exception as PrismaLikeError;
      if (prismaError?.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'A record with these values already exists';
        error = 'Conflict';
      } else if (prismaError?.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'The requested record was not found';
        error = 'Not Found';
      } else if (prismaError?.code === 'P2003') {
        status = HttpStatus.CONFLICT;
        message = 'This record is still referenced by other data';
        error = 'Conflict';
      } else if (prismaError?.code === 'P2034') {
        status = HttpStatus.CONFLICT;
        message = 'The request conflicted with another transaction. Please retry.';
        error = 'Conflict';
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} failed`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      message = 'An unexpected error occurred';
      error = 'Internal Server Error';
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}
