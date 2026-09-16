import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import type { Response } from 'express';
import type { AuthUserDto } from '@fbm/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './jwt.strategy';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private toAuthUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: AuthUserDto['role'];
  }): AuthUserDto {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private cookieOptions(maxAgeMs: number) {
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true';
    const sameSite = (this.config.get<string>('COOKIE_SAME_SITE') ??
      'lax') as 'lax' | 'strict' | 'none';
    return {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: maxAgeMs,
    };
  }

  private parseDurationToMs(value: string, fallbackMs: number): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) return fallbackMs;
    const amount = Number(match[1]);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60_000,
      h: 3_600_000,
      d: 86_400_000,
    };
    return amount * (multipliers[unit] ?? fallbackMs);
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const accessTtl = this.parseDurationToMs(
      this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      15 * 60_000,
    );
    const refreshTtl = this.parseDurationToMs(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      7 * 86_400_000,
    );

    res.cookie(ACCESS_COOKIE, accessToken, this.cookieOptions(accessTtl));
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions(refreshTtl));
  }

  clearAuthCookies(res: Response) {
    const secure = this.config.get<string>('COOKIE_SECURE') === 'true';
    const sameSite = (this.config.get<string>('COOKIE_SAME_SITE') ??
      'lax') as 'lax' | 'strict' | 'none';
    const base = { httpOnly: true, secure, sameSite, path: '/' };
    res.clearCookie(ACCESS_COOKIE, base);
    res.clearCookie(REFRESH_COOKIE, base);
  }

  private async issueTokens(
    user: AuthUserDto,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: (this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ??
        '15m') as `${number}m`,
    });

    const refreshToken = randomBytes(48).toString('hex');
    const refreshTtl = this.parseDurationToMs(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d',
      7 * 86_400_000,
    );

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshTtl),
        userAgent: meta?.userAgent,
        ipAddress: meta?.ipAddress,
      },
    });

    return { accessToken, refreshToken };
  }

  async login(
    dto: LoginDto,
    res: Response,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is not active');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const authUser = this.toAuthUser(user);
    const tokens = await this.issueTokens(authUser, meta);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'AUTH_LOGIN',
        entityType: 'User',
        entityId: user.id,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });

    return { user: authUser };
  }

  async refresh(
    refreshToken: string | undefined,
    res: Response,
    meta?: { userAgent?: string; ipAddress?: string },
  ) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (stored.user.deletedAt || stored.user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account is not active');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const authUser = this.toAuthUser(stored.user);
    const tokens = await this.issueTokens(authUser, meta);
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return { user: authUser };
  }

  async logout(userId: string | undefined, refreshToken: string | undefined, res: Response) {
    if (refreshToken) {
      const tokenHash = this.hashToken(refreshToken);
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'AUTH_LOGOUT',
          entityType: 'User',
          entityId: userId,
        },
      });
    }

    this.clearAuthCookies(res);
    return { success: true };
  }

  async me(userId: string): Promise<AuthUserDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null, status: 'ACTIVE' },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.toAuthUser(user);
  }
}
