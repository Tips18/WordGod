import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type {
  EmailCodeLoginRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SendEmailCodeRequest,
} from '@word-god/contracts';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';

/**
 * `AuthController` 暴露认证相关的 HTTP 接口。
 */
@Controller('auth')
export class AuthController {
  /**
   * `constructor` 注入认证控制器所需的服务。
   */
  constructor(private readonly authService: AuthService) {}

  /**
   * `me` 获取当前登录用户信息。
   */
  @Get('me')
  async me(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: { id: string; email: string } } | { user: null }> {
    const session = await this.authService.resolveSessionFromCookies(
      request,
      response,
    );

    if (!session) {
      return { user: null };
    }

    return { user: session.user };
  }

  /**
   * `sendEmailCode` 发送当前认证用途所需的邮箱验证码。
   */
  @Post('email-codes')
  async sendEmailCode(
    @Body() input: SendEmailCodeRequest,
  ): Promise<{ success: true }> {
    return this.authService.sendEmailCode(input);
  }

  /**
   * `register` 创建用户并写入认证 cookies。
   */
  @Post('register')
  async register(
    @Body() input: RegisterRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: { id: string; email: string } }> {
    const session = await this.authService.register(input);

    this.authService.writeCookies(
      response,
      session.accessToken,
      session.refreshToken,
      session.refreshTokenMaxAgeMs,
    );
    return { user: session.user };
  }

  /**
   * `login` 校验邮箱密码并写入认证 cookies。
   */
  @Post('login')
  async login(
    @Body() input: LoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: { id: string; email: string } }> {
    const session = await this.authService.login(input);

    this.authService.writeCookies(
      response,
      session.accessToken,
      session.refreshToken,
      session.refreshTokenMaxAgeMs,
    );
    return { user: session.user };
  }

  /**
   * `loginWithEmailCode` 使用邮箱验证码登录并写入认证 cookies。
   */
  @Post('login/email-code')
  async loginWithEmailCode(
    @Body() input: EmailCodeLoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: { id: string; email: string } }> {
    const session = await this.authService.loginWithEmailCode(input);

    this.authService.writeCookies(
      response,
      session.accessToken,
      session.refreshToken,
      session.refreshTokenMaxAgeMs,
    );
    return { user: session.user };
  }

  /**
   * `resetPassword` 使用邮箱验证码重置密码并写入认证 cookies。
   */
  @Post('password/reset')
  async resetPassword(
    @Body() input: ResetPasswordRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: { id: string; email: string } }> {
    const session = await this.authService.resetPassword(input);

    this.authService.writeCookies(
      response,
      session.accessToken,
      session.refreshToken,
      session.refreshTokenMaxAgeMs,
    );
    return { user: session.user };
  }

  /**
   * `logout` 清理当前请求的认证 cookies 与刷新会话。
   */
  @Post('logout')
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    const refreshToken = request.cookies?.word_god_refresh_token as
      string | undefined;

    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }

    this.authService.clearCookies(response);
    return { success: true };
  }
}
