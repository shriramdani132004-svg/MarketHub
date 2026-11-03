import { SetMetadata } from '@nestjs/common';
import type { Role } from '../types/auth-user';

export const IS_PUBLIC_KEY = 'markethub:isPublic';
export const ROLES_KEY = 'markethub:roles';

/** Marks a route as reachable without an authenticated session. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restricts a route to the given database-backed roles. ADMIN always passes. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
