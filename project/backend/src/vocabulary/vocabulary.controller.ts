import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { VocabularyService } from './vocabulary.service';

/**
 * `VocabularyController` 暴露生词本列表与详情接口。
 */
@Controller('vocabulary')
export class VocabularyController {
  /**
   * `constructor` 注入生词本控制器所需的服务。
   */
  constructor(
    private readonly vocabularyService: VocabularyService,
    private readonly authService: AuthService,
  ) {}

  /**
   * `listVocabulary` 返回当前用户的生词本列表。
   */
  @Get()
  async listVocabulary(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.requireSessionFromCookies(
      request,
      response,
    );

    return this.vocabularyService.listForUser(session.user.id);
  }

  /**
   * `getVocabularyDetail` 返回指定 lemma 的生词详情。
   */
  @Get(':lemma')
  async getVocabularyDetail(
    @Param('lemma') lemma: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.requireSessionFromCookies(
      request,
      response,
    );

    return this.vocabularyService.getDetail(session.user.id, lemma);
  }
}
