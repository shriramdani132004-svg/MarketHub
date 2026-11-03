import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { PrismaService } from '../database/prisma.service';
import { hashToken, slugify } from '../common/utils/crypto.util';
import type {
  JwtRefreshPayload,
} from '../common/types/auth-user';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../common/guards/jwt-auth.guard';
import type {
  BootstrapAdminDto,
  LoginDto,
  RegisterDto,
  SellerApplyDto,
} from './dto/auth.dto';
import { AuthCookieService, type AuthTokens } from './auth-cookie.service';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  phone: true,
  status: true,
  createdAt: true,
  sellerProfile: {
    select: {
      id: true,
      storeName: true,
      storeSlug: true,
      description: true,
      logoUrl: true,
      approvalStatus: true,
      approvedAt: true,
      rejectionReason: true,
      createdAt: true,
    },
  },
} as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cookieService: AuthCookieService,
  ) {}

  async register(dto: RegisterDto, request: Request, response: Response) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash,
        phone: dto.phone?.trim() || null,
        // Public registration can only ever create a CUSTOMER account.
        role: 'CUSTOMER',
      },
      select: publicUserSelect,
    });

    const tokens = await this.createSession(user.id, request);
    this.cookieService.setAuthCookies(response, tokens);
    return { user };
  }

  async applyAsSeller(dto: SellerApplyDto, request: Request, response: Response) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await this.hashPassword(dto.password);
    const baseSlug = slugify(dto.storeSlug || dto.storeName);
    const storeSlug = await this.uniqueStoreSlug(baseSlug);

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email,
          passwordHash,
          phone: dto.phone?.trim() || null,
          role: 'SELLER',
        },
        select: publicUserSelect,
      });
      await tx.sellerProfile.create({
        data: {
          userId: created.id,
          storeName: dto.storeName.trim(),
          storeSlug,
          description: dto.description?.trim() || null,
          businessContact: dto.businessContact?.trim() || null,
          approvalStatus: 'PENDING',
        },
      });
      const admins = await tx.user.findMany({
        where: { role: 'ADMIN', status: 'ACTIVE' },
        select: { id: true },
      });
      if (admins.length > 0) {
        await tx.notification.createMany({
          data: admins.map((admin) => ({
            userId: admin.id,
            type: 'SELLER_APPLICATION',
            title: 'New seller application',
            message: `${dto.storeName.trim()} applied to sell on MarketHub.`,
            link: '/admin/sellers/',
          })),
        });
      }
      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        select: publicUserSelect,
      });
    });

    const tokens = await this.createSession(user.id, request);
    this.cookieService.setAuthCookies(response, tokens);
    return { user };
  }

  async login(dto: LoginDto, request: Request, response: Response) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Always perform a hash verification to reduce account enumeration timing leaks.
      await this.hashPassword(dto.password);
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('This account has been suspended');
    }

    const tokens = await this.createSession(user.id, request);
    this.cookieService.setAuthCookies(response, tokens);

    const profile = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: publicUserSelect,
    });
    return { user: profile };
  }

  async refresh(request: Request, response: Response) {
    const cookies = request.cookies as Record<string, string> | undefined;
    const token = cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException('Refresh token is missing');

    let payload: JwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(token, {
        secret: this.configService.get<string>('jwtRefreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
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

    const presentedHash = hashToken(token);
    const stored = Buffer.from(session.refreshTokenHash);
    const presented = Buffer.from(presentedHash);
    if (stored.length !== presented.length || !timingSafeEqual(stored, presented)) {
      // A previously rotated token was replayed: revoke the whole session.
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      this.logger.warn(`Refresh token reuse detected for session ${session.id}`);
      throw new UnauthorizedException('Refresh token has already been used');
    }

    const tokens = await this.rotateSession(session.id, session.userId);
    this.cookieService.setAuthCookies(response, tokens);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: session.userId },
      select: publicUserSelect,
    });
    return { user };
  }

  async logout(request: Request, response: Response) {
    const cookies = request.cookies as Record<string, string> | undefined;
    const token = cookies?.[REFRESH_COOKIE];
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(token, {
          secret: this.configService.get<string>('jwtRefreshSecret'),
        });
        await this.prisma.session.updateMany({
          where: { id: payload.sid, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } catch {
        // Expired/invalid refresh cookies still get cleared below.
      }
    }
    this.cookieService.clearAuthCookies(response);
    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return { user };
  }

  issueCsrfToken(response: Response) {
    const token = this.cookieService.newCsrfToken();
    this.cookieService.setCsrfCookie(response, token);
    return { csrfToken: token };
  }

  async bootstrapAdmin(
    dto: BootstrapAdminDto,
    providedSecret: string | undefined,
    request: Request,
    response: Response,
  ) {
    const configured = this.configService.get<string>('adminBootstrapSecret');
    if (!configured) {
      throw new ForbiddenException(
        'Administrator bootstrap is disabled. Set ADMIN_BOOTSTRAP_SECRET to enable it.',
      );
    }
    if (!providedSecret) {
      throw new ForbiddenException('Bootstrap secret is required');
    }
    const provided = Buffer.from(providedSecret);
    const expected = Buffer.from(configured);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new ForbiddenException('Invalid bootstrap secret');
    }

    const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount > 0) {
      throw new ForbiddenException(
        'An administrator already exists. Bootstrap is permanently disabled.',
      );
    }

    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash: await this.hashPassword(dto.password),
        role: 'ADMIN',
      },
      select: publicUserSelect,
    });

    const tokens = await this.createSession(user.id, request);
    this.cookieService.setAuthCookies(response, tokens);
    this.logger.log('Initial administrator bootstrapped');
    return { user, created: true };
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  private async uniqueStoreSlug(base: string): Promise<string> {
    let candidate = base;
    let suffix = 2;
    // Bound the loop; store names are short and collisions are rare.
    while (suffix < 100) {
      const taken = await this.prisma.sellerProfile.findUnique({
        where: { storeSlug: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return `${base}-${randomUUID().slice(0, 8)}`;
  }

  private async createSession(userId: string, request: Request): Promise<AuthTokens> {
    const sid = randomUUID();
    const tokens = await this.signTokens(userId, sid);
    const refreshTtl = this.configService.get<number>('refreshTtlSeconds') ?? 604800;
    await this.prisma.session.create({
      data: {
        id: sid,
        userId,
        refreshTokenHash: hashToken(tokens.refreshToken),
        userAgent: request.headers['user-agent']?.slice(0, 255) ?? null,
        ipAddress: request.ip?.slice(0, 64) ?? null,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });
    return tokens;
  }

  private async rotateSession(sessionId: string, userId: string): Promise<AuthTokens> {
    const tokens = await this.signTokens(userId, sessionId);
    const refreshTtl = this.configService.get<number>('refreshTtlSeconds') ?? 604800;
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: hashToken(tokens.refreshToken),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
        lastUsedAt: new Date(),
      },
    });
    return tokens;
  }

  private async signTokens(userId: string, sid: string): Promise<AuthTokens> {
    const accessTtl = this.configService.get<number>('accessTtlSeconds') ?? 900;
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: userId, sid, type: 'access' },
        {
          secret: this.configService.get<string>('jwtSecret'),
          expiresIn: accessTtl,
        },
      ),
      this.jwtService.signAsync(
        { sub: userId, sid, type: 'refresh' },
        {
          secret: this.configService.get<string>('jwtRefreshSecret'),
          expiresIn: this.configService.get<number>('refreshTtlSeconds') ?? 604800,
        },
      ),
    ]);
    return {
      accessToken,
      refreshToken,
      csrfToken: this.cookieService.newCsrfToken(),
    };
  }

  async currentSessionIdFromCookies(request: Request): Promise<string | null> {
    const token = (request.cookies as Record<string, string> | undefined)?.[
      ACCESS_COOKIE
    ];
    if (!token) return null;
    try {
      const payload = await this.jwtService.verifyAsync<{ sid?: string }>(token, {
        secret: this.configService.get<string>('jwtSecret'),
      });
      return payload.sid ?? null;
    } catch {
      return null;
    }
  }
}
