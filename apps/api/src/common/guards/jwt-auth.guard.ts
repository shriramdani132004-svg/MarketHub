import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/auth.decorators';
import type { AuthUser, JwtAccessPayload } from '../types/auth-user';

export const ACCESS_COOKIE = 'mh_access';
export const REFRESH_COOKIE = 'mh_refresh';
export const CSRF_COOKIE = 'mh_csrf';
export const CSRF_HEADER = 'x-csrf-token';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(request);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
        secret: this.configService.get<string>('jwtSecret'),
      });
      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      const session = await this.prisma.session.findUnique({
        where: { id: payload.sid },
        include: { user: true },
      });

      if (
        !session ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now() ||
        session.user.status !== 'ACTIVE' ||
        session.userId !== payload.sub
      ) {
        throw new UnauthorizedException('Session is no longer valid');
      }

      request.user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
        sessionId: session.id,
      };
      return true;
    } catch (error) {
      if (isPublic) return true;
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired session');
    }
  }

  private extractToken(request: Request): string | undefined {
    const cookies = request.cookies as Record<string, string> | undefined;
    const cookieToken = cookies?.[ACCESS_COOKIE];
    if (cookieToken) return cookieToken;

    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice('Bearer '.length).trim();
    }
    return undefined;
  }
}
