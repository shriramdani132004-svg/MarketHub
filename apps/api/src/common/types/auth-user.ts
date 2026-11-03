export type Role = 'CUSTOMER' | 'SELLER' | 'ADMIN';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  sessionId: string;
}

export interface JwtAccessPayload {
  sub: string;
  sid: string;
  type: 'access';
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string;
  sid: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}
