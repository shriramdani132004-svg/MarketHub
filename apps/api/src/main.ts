import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

function resolveWebDist(): string | null {
  const candidates = [
    process.env.WEB_DIST_DIR,
    resolve(__dirname, '../public'),
    resolve(process.cwd(), 'apps/api/public'),
    resolve(process.cwd(), 'apps/web/out'),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) return candidate;
  }
  return null;
}

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 4000;
  const frontendOrigin = config.get<string>('frontendOrigin') ?? 'http://localhost:4000';

  app.set('trust proxy', 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = Date.now();
    res.on('finish', () => {
      if (req.originalUrl.startsWith('/api/v1/health')) return;
      // Structured access log without cookies, authorization headers or bodies.
      console.log(
        JSON.stringify({
          level: 'info',
          type: 'http',
          method: req.method,
          path: req.originalUrl.split('?')[0],
          status: res.statusCode,
          durationMs: Date.now() - started,
          timestamp: new Date().toISOString(),
        }),
      );
    });
    next();
  });

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const allowed = new Set([
        frontendOrigin,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:4000',
      ]);
      return callback(null, allowed.has(origin));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      stopAtFirstError: false,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MarketHub API')
    .setDescription(
      'REST API for the MarketHub multi-vendor marketplace. Authentication uses secure HttpOnly cookies. State-changing cookie requests require the x-csrf-token header from GET /api/v1/auth/csrf. Payments are simulated only.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Authentication')
    .addTag('Account')
    .addTag('Stores')
    .addTag('Categories')
    .addTag('Products')
    .addTag('Cart')
    .addTag('Checkout')
    .addTag('Payments')
    .addTag('Customer Orders')
    .addTag('Seller')
    .addTag('Seller Products')
    .addTag('Seller Orders')
    .addTag('Administration')
    .addTag('Analytics')
    .addTag('Health')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'MarketHub API',
  });

  const webDist = resolveWebDist();
  if (webDist) {
    app.useStaticAssets(webDist, {
      index: 'index.html',
      setHeaders: (res, filePath) => {
        if (
          filePath.includes('_next/static') ||
          /\.(woff2?|ttf|otf|png|jpe?g|webp|svg|ico)$/i.test(filePath)
        ) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    });
    logger.log(`Serving static frontend from ${webDist}`);
  } else {
    logger.warn('No static frontend build found; API-only mode');
  }

  await app.init();

  if (webDist) {
    const server = app.getHttpAdapter().getInstance() as express.Express;
    const notFoundPage = join(webDist, '404.html');
    server.use((req: Request, res: Response) => {
      if (req.path.startsWith('/api')) {
        res.status(404).json({
          statusCode: 404,
          message: 'API route not found',
          error: 'Not Found',
          path: req.originalUrl,
        });
        return;
      }
      if ((req.method === 'GET' || req.method === 'HEAD') && existsSync(notFoundPage)) {
        res.status(404).sendFile(notFoundPage);
        return;
      }
      res.status(404).json({
        statusCode: 404,
        message: 'Page not found',
        error: 'Not Found',
        path: req.originalUrl,
      });
    });
  }

  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
  logger.log(`MarketHub is listening on http://0.0.0.0:${port}`);
}

bootstrap().catch((error) => {
  // Never print environment values or credentials.
  console.error(
    JSON.stringify({
      level: 'fatal',
      type: 'startup',
      message: error instanceof Error ? error.message : 'Unknown startup error',
      stack: error instanceof Error ? error.stack : undefined,
    }),
  );
  process.exit(1);
});
