import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { CsrfGuard } from '../../src/common/guards/csrf.guard';

type RequestLike = {
  method: string;
  originalUrl: string;
  headers: Record<string, string | undefined>;
  cookies?: Record<string, string>;
  protocol?: string;
};

function contextFor(request: RequestLike): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard() {
  const config = {
    get: jest.fn((key: string) =>
      key === 'frontendOrigin' ? 'https://markethub.example' : undefined,
    ),
  };
  return new CsrfGuard(config as never);
}

function baseRequest(overrides: Partial<RequestLike> = {}): RequestLike {
  return {
    method: 'POST',
    originalUrl: '/api/v1/orders',
    headers: { host: 'markethub.example', 'x-forwarded-proto': 'https' },
    cookies: {},
    ...overrides,
  };
}

describe('CsrfGuard', () => {
  it('allows safe methods without a token', () => {
    const guard = makeGuard();
    for (const method of ['GET', 'HEAD', 'OPTIONS']) {
      expect(guard.canActivate(contextFor(baseRequest({ method })))).toBe(true);
    }
  });

  it('allows the admin bootstrap route (secret-authenticated)', () => {
    const guard = makeGuard();
    expect(
      guard.canActivate(
        contextFor(baseRequest({ originalUrl: '/api/v1/auth/admin/bootstrap' })),
      ),
    ).toBe(true);
  });

  it('allows health and docs paths', () => {
    const guard = makeGuard();
    expect(
      guard.canActivate(
        contextFor(baseRequest({ originalUrl: '/api/v1/health/ready' })),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(contextFor(baseRequest({ originalUrl: '/api/docs' }))),
    ).toBe(true);
  });

  it('allows bearer-token API clients', () => {
    const guard = makeGuard();
    expect(
      guard.canActivate(
        contextFor(
          baseRequest({ headers: { host: 'markethub.example', authorization: 'Bearer abc' } }),
        ),
      ),
    ).toBe(true);
  });

  it('rejects a request with no token', () => {
    const guard = makeGuard();
    expect(() => guard.canActivate(contextFor(baseRequest()))).toThrow(
      ForbiddenException,
    );
  });

  it('rejects when only the cookie is present', () => {
    const guard = makeGuard();
    expect(() =>
      guard.canActivate(contextFor(baseRequest({ cookies: { mh_csrf: 'abc' } }))),
    ).toThrow(ForbiddenException);
  });

  it('rejects when only the header is present', () => {
    const guard = makeGuard();
    expect(() =>
      guard.canActivate(
        contextFor(baseRequest({ headers: { host: 'markethub.example', 'x-csrf-token': 'abc' } })),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects mismatched cookie and header values', () => {
    const guard = makeGuard();
    expect(() =>
      guard.canActivate(
        contextFor(
          baseRequest({
            cookies: { mh_csrf: 'abc' },
            headers: { host: 'markethub.example', 'x-csrf-token': 'abd' },
          }),
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('rejects mismatched token lengths without leaking timing', () => {
    const guard = makeGuard();
    expect(() =>
      guard.canActivate(
        contextFor(
          baseRequest({
            cookies: { mh_csrf: 'abc' },
            headers: { host: 'markethub.example', 'x-csrf-token': 'abcdef' },
          }),
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('accepts matching double-submit tokens', () => {
    const guard = makeGuard();
    expect(
      guard.canActivate(
        contextFor(
          baseRequest({
            cookies: { mh_csrf: 'a'.repeat(32) },
            headers: { host: 'markethub.example', 'x-csrf-token': 'a'.repeat(32) },
          }),
        ),
      ),
    ).toBe(true);
  });

  it('rejects a foreign origin', () => {
    const guard = makeGuard();
    expect(() =>
      guard.canActivate(
        contextFor(
          baseRequest({
            headers: { host: 'markethub.example', origin: 'https://evil.example' },
            cookies: { mh_csrf: 'a'.repeat(32) },
          }),
        ),
      ),
    ).toThrow(ForbiddenException);
  });

  it('allows the configured frontend origin', () => {
    const guard = makeGuard();
    expect(
      guard.canActivate(
        contextFor(
          baseRequest({
            headers: {
              host: 'markethub.example',
              origin: 'https://markethub.example',
              'x-csrf-token': 'a'.repeat(32),
            },
            cookies: { mh_csrf: 'a'.repeat(32) },
          }),
        ),
      ),
    ).toBe(true);
  });
});
