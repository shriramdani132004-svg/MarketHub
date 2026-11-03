import { config as loadEnv } from 'dotenv';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Load the workspace .env before validation runs. Existing process env wins.
loadEnv();
loadEnv({ path: '../../.env' });

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  directUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
  frontendOrigin: string;
  cookieSecure: boolean;
  cookieSameSite: 'lax' | 'strict' | 'none';
  adminBootstrapSecret?: string;
  webDistDir?: string;
  reservationTtlMinutes: number;
}

function requireValue(key: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function positiveInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }
  return parsed;
}

export function validateEnvironment(): Record<string, unknown> {
  // Render exposes the public HTTPS origin automatically; use it when an
  // explicit FRONTEND_ORIGIN has not been configured.
  if (!process.env.FRONTEND_ORIGIN && process.env.RENDER_EXTERNAL_URL) {
    process.env.FRONTEND_ORIGIN = process.env.RENDER_EXTERNAL_URL;
  }
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const databaseUrl = requireValue('DATABASE_URL');
  const directUrl = process.env.DIRECT_URL ?? databaseUrl;
  if (!databaseUrl.startsWith('postgres')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string');
  }

  const jwtSecret = requireValue('JWT_SECRET');
  const jwtRefreshSecret = requireValue('JWT_REFRESH_SECRET');
  if (jwtSecret.length < 32 || jwtRefreshSecret.length < 32) {
    throw new Error('JWT secrets must contain at least 32 characters');
  }
  if (jwtSecret === jwtRefreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }

  const sameSiteRaw = (process.env.COOKIE_SAME_SITE ?? 'lax').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(sameSiteRaw)) {
    throw new Error('COOKIE_SAME_SITE must be lax, strict or none');
  }

  const frontendOrigin = requireValue('FRONTEND_ORIGIN').replace(/\/$/, '');
  if (!/^https?:\/\//.test(frontendOrigin)) {
    throw new Error('FRONTEND_ORIGIN must be an absolute http(s) URL');
  }

  return {
    nodeEnv,
    port: positiveInt('PORT', 4000),
    databaseUrl,
    directUrl,
    jwtSecret,
    jwtRefreshSecret,
    accessTtlSeconds: positiveInt('JWT_ACCESS_TTL', 900),
    refreshTtlSeconds: positiveInt('JWT_REFRESH_TTL', 604800),
    frontendOrigin,
    cookieSecure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === 'true'
      : nodeEnv === 'production',
    cookieSameSite: sameSiteRaw,
    adminBootstrapSecret: process.env.ADMIN_BOOTSTRAP_SECRET,
    webDistDir: process.env.WEB_DIST_DIR,
    reservationTtlMinutes: positiveInt('RESERVATION_TTL_MINUTES', 15),
  };
}

export const appConfigModule = ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  envFilePath: ['.env', '../../.env'],
  validate: validateEnvironment,
});

export type TypedConfigService = ConfigService<AppConfig, true>;
