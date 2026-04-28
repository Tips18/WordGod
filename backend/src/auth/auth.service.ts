import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from '@word-god/contracts';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';
import { APP_STORE } from '../store/app-store';
import type { AppStore } from '../store/app-store';

const ACCESS_COOKIE = 'word_god_access_token';
const REFRESH_COOKIE = 'word_god_refresh_token';

/**
 * `AuthSessionResult` 描述认证服务返回的完整会话结果。
 */
export interface AuthSessionResult extends AuthResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * `ResolvedSession` 描述从 cookies 中恢复出的当前会话。
 */
export interface ResolvedSession {
  user: {
    id: string;
    email: string;
  };
  accessToken: string | null;
  refreshToken: string | null;
}

/**
 * `AuthService` 负责邮箱密码认证、Cookie 读写和会话恢复。
 */
@Injectable()
export class AuthService {
  private readonly jwtService: JwtService;

  /**
   * `constructor` 初始化认证服务所需的依赖。
   */
  constructor(
    @Inject(APP_STORE) private readonly store: AppStore,
    private readonly jwtSecret: string,
  ) {
    this.jwtService = new JwtService({ secret: jwtSecret });
  }

  /**
   * `register` 创建新用户并签发访问令牌与刷新令牌。
   */
  async register(input: RegisterRequest): Promise<AuthSessionResult> {
    const existingUser = await this.store.findUserByEmail(input.email);

    if (existingUser) {
      throw new UnauthorizedException('邮箱已被注册');
    }

    const now = new Date().toISOString();
    const passwordHash = await hash(input.password, 10);
    const savedUser = await this.store.saveUser({
      email: input.email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    return this.createSession(savedUser.id, savedUser.email);
  }

  /**
   * `login` 校验邮箱密码并签发新会话。
   */
  async login(input: LoginRequest): Promise<AuthSessionResult> {
    const savedUser = await this.store.findUserByEmail(input.email);

    if (!savedUser) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const matched = await compare(input.password, savedUser.passwordHash);

    if (!matched) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    return this.createSession(savedUser.id, savedUser.email);
  }

  /**
   * `logout` 删除与刷新令牌对应的持久化会话。
   */
  async logout(refreshToken: string): Promise<void> {
    for (const session of await this.store.listSessions()) {
      const matched = await compare(refreshToken, session.refreshTokenHash);

      if (matched) {
        await this.store.removeSessionById(session.id);
        return;
      }
    }
  }

  /**
   * `writeCookies` 将访问令牌和刷新令牌写入 HttpOnly cookies。
   */
  writeCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    response.cookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });
    response.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  /**
   * `clearCookies` 清理认证 cookies。
   */
  clearCookies(response: Response): void {
    response.clearCookie(ACCESS_COOKIE);
    response.clearCookie(REFRESH_COOKIE);
  }

  /**
   * `resolveSessionFromCookies` 尝试从访问令牌或刷新令牌恢复当前会话。
   */
  async resolveSessionFromCookies(
    request: Request,
    response: Response,
  ): Promise<ResolvedSession | null> {
    const accessToken = request.cookies?.[ACCESS_COOKIE] as string | undefined;
    const refreshToken = request.cookies?.[REFRESH_COOKIE] as
      | string
      | undefined;

    if (accessToken) {
      try {
        const payload = await this.jwtService.verifyAsync<{
          sub: string;
          email: string;
        }>(accessToken, {
          secret: this.jwtSecret,
        });
        const user = await this.store.findUserById(payload.sub);

        if (user) {
          return {
            user: {
              id: user.id,
              email: user.email,
            },
            accessToken,
            refreshToken: refreshToken ?? null,
          };
        }
      } catch {
        // Access token 无效时继续尝试刷新会话。
      }
    }

    if (!refreshToken) {
      return null;
    }

    for (const session of await this.store.listSessions()) {
      const matched = await compare(refreshToken, session.refreshTokenHash);

      if (!matched) {
        continue;
      }

      if (new Date(session.expiresAt).getTime() <= Date.now()) {
        await this.store.removeSessionById(session.id);
        return null;
      }

      const user = await this.store.findUserById(session.userId);

      if (!user) {
        return null;
      }

      const nextAccessToken = await this.jwtService.signAsync({
        sub: user.id,
        email: user.email,
      });

      response.cookie(ACCESS_COOKIE, nextAccessToken, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
        },
        accessToken: nextAccessToken,
        refreshToken,
      };
    }

    return null;
  }

  /**
   * `requireSessionFromCookies` 强制要求当前请求已经登录。
   */
  async requireSessionFromCookies(
    request: Request,
    response: Response,
  ): Promise<ResolvedSession> {
    const session = await this.resolveSessionFromCookies(request, response);

    if (!session) {
      throw new UnauthorizedException('需要登录');
    }

    return session;
  }

  /**
   * `createSession` 为指定用户创建访问令牌和刷新会话。
   */
  private async createSession(
    userId: string,
    email: string,
  ): Promise<AuthSessionResult> {
    const refreshToken = randomUUID();
    const refreshTokenHash = await hash(refreshToken, 10);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const accessToken = await this.jwtService.signAsync({
      sub: userId,
      email,
    });

    await this.store.saveSession({
      userId,
      refreshTokenHash,
      createdAt: now.toISOString(),
      expiresAt,
    });

    return {
      user: {
        id: userId,
        email,
      },
      accessToken,
      refreshToken,
    };
  }
}
