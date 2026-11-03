import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { CSRF_COOKIE, CSRF_HEADER } from './jwt-auth.guard';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const path = request.originalUrl.split('?')[0];
    if (path.startsWith('/api/docs') || path.startsWith('/api/v1/health')) {
      return true;
    }
    // The bootstrap utility authenticates with a one-time shared secret and is
    // not cookie based, so traditional CSRF does not apply.
    if (path === '/api/v1/auth/admin/bootstrap') return true;

    // Bearer-token API clients are not vulnerable to cookie CSRF.
    if (request.headers.authorization?.startsWith('Bearer ')) {
      return true;
    }

    const origin = request.headers.origin;
    if (origin) {
      const allowed = this.allowedOrigins(request);
      if (!allowed.has(origin)) {
        throw new ForbiddenException('Request origin is not allowed');
      }
    }

    const cookies = request.cookies as Record<string, string> | undefined;
    const cookieToken = cookies?.[CSRF_COOKIE];
    const headerToken = request.headers[CSRF_HEADER];
    const headerValue = Array.isArray(headerToken) ? headerToken[0] : headerToken;

    if (!cookieToken || !headerValue || cookieToken.length !== headerValue.length) {
      throw new ForbiddenException('Missing or invalid CSRF token');
    }

    const cookieBuffer = Buffer.from(cookieToken);
    const headerBuffer = Buffer.from(headerValue);
    if (
      cookieBuffer.length !== headerBuffer.length ||
      !timingSafeEqual(cookieBuffer, headerBuffer)
    ) {
      throw new ForbiddenException('Missing or invalid CSRF token');
    }

    return true;
  }

  private allowedOrigins(request: Request): Set<string> {
    const configured = (this.configService.get<string>('frontendOrigin') ?? '').replace(
      /\/$/,
      '',
    );
    const host = request.headers.host;
    const protocol = request.headers['x-forwarded-proto'] ?? request.protocol;
    const origins = new Set<string>([configured]);
    if (host) origins.add(`${protocol}://${host}`);
    return origins;
  }
}
