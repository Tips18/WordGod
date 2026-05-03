import {
  CompleteReadingAttemptResponse,
  ReadingPassageResponse,
  SyncReadingAttemptRequest,
} from '@word-god/contracts';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { APP_STORE } from '../store/app-store';
import type { AppStore } from '../store/app-store';
import { VocabularyService } from '../vocabulary/vocabulary.service';
import { EcdictDictionaryService } from './ecdict-dictionary.service';
import { PassageTranslator } from './passage-translator';

/**
 * `ReadingService` 负责阅读检测页的数据分发与完成结算。
 */
@Injectable()
export class ReadingService {
  /**
   * `constructor` 注入阅读流程所需的服务。
   */
  constructor(
    @Inject(APP_STORE) private readonly store: AppStore,
    private readonly vocabularyService: VocabularyService,
    private readonly passageTranslator: PassageTranslator,
    private readonly dictionaryService: EcdictDictionaryService,
  ) {}

  /**
   * `enrichPassageTokens` 用本地英汉词典补齐段落 token 的中文释义。
   */
  private async enrichPassageTokens(
    passage: Awaited<ReturnType<PassageTranslator['translatePassage']>>,
  ): Promise<Awaited<ReturnType<PassageTranslator['translatePassage']>>> {
    return {
      ...passage,
      tokens: await this.dictionaryService.enrichTokens(passage.tokens),
    };
  }

  /**
   * `getRandomPassage` 返回一个不与上次相同的可阅读段落。
   */
  async getRandomPassage(
    userId?: string,
    excludePassageId?: string,
  ): Promise<ReadingPassageResponse> {
    const passages = await this.store.listPassages();
    const availablePassages = excludePassageId
      ? passages.filter((passage) => passage.id !== excludePassageId)
      : passages;
    const selectedPassage =
      availablePassages[Math.floor(Math.random() * availablePassages.length)] ??
      passages[0];

    if (!selectedPassage) {
      throw new NotFoundException('暂无可用段落');
    }

    const translatedPassage = await this.enrichPassageTokens(
      await this.passageTranslator.translatePassage(selectedPassage),
    );
    const selectedTokenIds = userId
      ? ((await this.store.findAttempt(userId, selectedPassage.id))
          ?.selectedTokenIds ?? [])
      : [];

    return {
      passage: {
        id: translatedPassage.id,
        examType: translatedPassage.examType,
        year: translatedPassage.year,
        paper: translatedPassage.paper,
        questionType: translatedPassage.questionType,
        passageIndex: translatedPassage.passageIndex,
        title: translatedPassage.title,
        content: translatedPassage.content,
        sourceUrl: translatedPassage.sourceUrl,
      },
      sentences: translatedPassage.sentences,
      tokens: translatedPassage.tokens,
      selectedTokenIds,
      requiresAuthToComplete: true,
    };
  }

  /**
   * `syncAttempt` 以整段覆盖的方式更新当前用户的选择集合。
   */
  async syncAttempt(
    userId: string,
    passageId: string,
    payload: SyncReadingAttemptRequest,
  ): Promise<void> {
    const passage = await this.store.findPassage(passageId);

    if (!passage) {
      throw new NotFoundException('段落不存在');
    }

    const validTokenIds = new Set(passage.tokens.map((token) => token.id));
    const uniqueSelection = [...new Set(payload.selectedTokenIds)].filter(
      (tokenId) => validTokenIds.has(tokenId),
    );

    await this.store.saveAttempt({
      userId,
      passageId,
      selectedTokenIds: uniqueSelection,
      completedAt: null,
    });
  }

  /**
   * `completeAttempt` 结算当前段落并返回下一段内容。
   */
  async completeAttempt(
    userId: string,
    passageId: string,
  ): Promise<CompleteReadingAttemptResponse> {
    const attempt = await this.store.findAttempt(userId, passageId);
    const passage = await this.store.findPassage(passageId);

    if (!passage) {
      throw new NotFoundException('段落不存在');
    }

    const translatedPassage = await this.enrichPassageTokens(
      await this.passageTranslator.translatePassage(passage),
    );
    const selectedTokens = translatedPassage.tokens.filter((token) =>
      attempt?.selectedTokenIds.includes(token.id),
    );
    const savedLemmaCount = await this.vocabularyService.recordMarks(
      userId,
      translatedPassage,
      selectedTokens,
    );

    await this.store.saveAttempt({
      id: attempt?.id,
      userId,
      passageId,
      selectedTokenIds: attempt?.selectedTokenIds ?? [],
      completedAt: new Date().toISOString(),
    });

    return {
      completedPassageId: passageId,
      savedLemmaCount,
      nextPassage: await this.getRandomPassage(userId, passageId),
    };
  }
}
