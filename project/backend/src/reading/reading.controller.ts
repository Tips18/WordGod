import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { SyncReadingAttemptRequest } from '@word-god/contracts';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { ReadingService } from './reading.service';

/**
 * `ReadingController` 暴露阅读检测页所需的 HTTP 接口。
 */
@Controller('reading')
export class ReadingController {
  /**
   * `constructor` 注入阅读控制器所需的服务。
   */
  constructor(
    private readonly readingService: ReadingService,
    private readonly authService: AuthService,
  ) {}

  /**
   * `getRandomPassage` 返回一段可阅读内容，并在存在会话时恢复临时状态。
   */
  @Get('passages/random')
  async getRandomPassage(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.resolveSessionFromCookies(
      request,
      response,
    );

    return this.readingService.getRandomPassage(session?.user.id);
  }

  /**
   * `syncAttempt` 使用完整 token 集合覆盖当前段落状态。
   */
  @Put('attempts/:passageId')
  async syncAttempt(
    @Param('passageId') passageId: string,
    @Body() payload: SyncReadingAttemptRequest,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ success: true }> {
    const session = await this.authService.requireSessionFromCookies(
      request,
      response,
    );

    await this.readingService.syncAttempt(session.user.id, passageId, payload);
    return { success: true };
  }

  /**
   * `completeAttempt` 结算当前段落并返回下一段。
   */
  @Post('attempts/:passageId/complete')
  async completeAttempt(
    @Param('passageId') passageId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.requireSessionFromCookies(
      request,
      response,
    );

    return this.readingService.completeAttempt(session.user.id, passageId);
  }
}
