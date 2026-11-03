import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import { randomToken } from '../common/utils/crypto.util';
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from '../common/guards/jwt-auth.guard';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

@Injectable()
export class AuthCookieService {
  constructor(private readonly configService: ConfigService) {}

  private baseOptions(): CookieOptions {
    const sameSite = this.configService.get<'lax' | 'strict' | 'none'>('cookieSameSite') ?? 'lax';
    return {
      secure: this.configService.get<boolean>('cookieSecure') ?? false,
      sameSite,
      domain: undefined,
    };
  }

  setAuthCookies(response: Response, tokens: AuthTokens): void {
    const accessTtl = this.configService.get<number>('accessTtlSeconds') ?? 900;
    const refreshTtl = this.configService.get<number>('refreshTtlSeconds') ?? 604800;
    const base = this.baseOptions();

    response.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...base,
      httpOnly: true,
      path: '/',
      maxAge: accessTtl * 1000,
    });
    response.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...base,
      httpOnly: true,
      path: '/api/v1/auth',
      maxAge: refreshTtl * 1000,
    });
    response.cookie(CSRF_COOKIE, tokens.csrfToken, {
      ...base,
      httpOnly: false,
      path: '/',
      maxAge: refreshTtl * 1000,
    });
  }

  setCsrfCookie(response: Response, token: string): void {
    const refreshTtl = this.configService.get<number>('refreshTtlSeconds') ?? 604800;
    response.cookie(CSRF_COOKIE, token, {
      ...this.baseOptions(),
      httpOnly: false,
      path: '/',
      maxAge: refreshTtl * 1000,
    });
  }

  clearAuthCookies(response: Response): void {
    const base = this.baseOptions();
    response.clearCookie(ACCESS_COOKIE, { ...base, path: '/' });
    response.clearCookie(REFRESH_COOKIE, { ...base, path: '/api/v1/auth' });
    response.clearCookie(CSRF_COOKIE, { ...base, path: '/' });
  }

  newCsrfToken(): string {
    return randomToken(32);
  }
}
