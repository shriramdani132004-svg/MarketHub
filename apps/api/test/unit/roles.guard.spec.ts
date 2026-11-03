import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../../src/common/guards/roles.guard';

type UserLike = { id: string; role: string } | undefined;

function contextFor(user: UserLike): ExecutionContext {
  return {
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(requiredRoles: string[] | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  };
  return new RolesGuard(reflector as never);
}

describe('RolesGuard', () => {
  it('allows routes with no role requirement', () => {
    expect(makeGuard(undefined).canActivate(contextFor(undefined))).toBe(true);
    expect(makeGuard([]).canActivate(contextFor(undefined))).toBe(true);
  });

  it('rejects anonymous requests on protected routes', () => {
    expect(() => makeGuard(['ADMIN']).canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('allows a matching role', () => {
    expect(
      makeGuard(['SELLER']).canActivate(contextFor({ id: 'u1', role: 'SELLER' })),
    ).toBe(true);
  });

  it('rejects a non-matching role', () => {
    expect(() =>
      makeGuard(['ADMIN']).canActivate(contextFor({ id: 'u1', role: 'CUSTOMER' })),
    ).toThrow(ForbiddenException);
  });

  it('lets administrators operate seller pages', () => {
    expect(
      makeGuard(['SELLER']).canActivate(contextFor({ id: 'a1', role: 'ADMIN' })),
    ).toBe(true);
  });

  it('does not let customers reach seller analytics', () => {
    expect(() =>
      makeGuard(['SELLER']).canActivate(contextFor({ id: 'c1', role: 'CUSTOMER' })),
    ).toThrow(ForbiddenException);
  });
});
