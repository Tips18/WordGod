import {
  CompleteReadingAttemptResponse,
  ReadingPassageResponse,
  SyncReadingAttemptRequest,
} from '@word-god/contracts';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InMemoryAppStore } from '../store/in-memory-app.store';
import { VocabularyService } from '../vocabulary/vocabulary.service';

/**
 * `ReadingService` 负责阅读检测页的数据分发与完成结算。
 */
@Injectable()
export class ReadingService {
  /**
   * `constructor` 注入阅读流程所需的服务。
   */
  constructor(
    private readonly store: InMemoryAppStore,
    private readonly vocabularyService: VocabularyService,
  ) {}

  /**
   * `getRandomPassage` 返回一个不与上次相同的可阅读段落。
   */
  getRandomPassage(
    userId?: string,
    excludePassageId?: string,
  ): ReadingPassageResponse {
    const passages = this.store.listPassages();
    const selectedPassage =
      passages.find((passage) => passage.id !== excludePassageId) ??
      passages[0];

    if (!selectedPassage) {
      throw new NotFoundException('暂无可用段落');
    }

    const selectedTokenIds = userId
      ? (this.store.findAttempt(userId, selectedPassage.id)?.selectedTokenIds ??
        [])
      : [];

    return {
      passage: {
        id: selectedPassage.id,
        examType: selectedPassage.examType,
        year: selectedPassage.year,
        paper: selectedPassage.paper,
        questionType: selectedPassage.questionType,
        passageIndex: selectedPassage.passageIndex,
        title: selectedPassage.title,
        content: selectedPassage.content,
        sourceUrl: selectedPassage.sourceUrl,
      },
      sentences: selectedPassage.sentences,
      tokens: selectedPassage.tokens,
      selectedTokenIds,
      requiresAuthToComplete: true,
    };
  }

  /**
   * `syncAttempt` 以整段覆盖的方式更新当前用户的选择集合。
   */
  syncAttempt(
    userId: string,
    passageId: string,
    payload: SyncReadingAttemptRequest,
  ): void {
    const passage = this.store.findPassage(passageId);

    if (!passage) {
      throw new NotFoundException('段落不存在');
    }

    const validTokenIds = new Set(passage.tokens.map((token) => token.id));
    const uniqueSelection = [...new Set(payload.selectedTokenIds)].filter(
      (tokenId) => validTokenIds.has(tokenId),
    );

    this.store.saveAttempt({
      userId,
      passageId,
      selectedTokenIds: uniqueSelection,
      completedAt: null,
    });
  }

  /**
   * `completeAttempt` 结算当前段落并返回下一段内容。
   */
  completeAttempt(
    userId: string,
    passageId: string,
  ): CompleteReadingAttemptResponse {
    const attempt = this.store.findAttempt(userId, passageId);
    const passage = this.store.findPassage(passageId);

    if (!passage) {
      throw new NotFoundException('段落不存在');
    }

    const selectedTokens = passage.tokens.filter((token) =>
      attempt?.selectedTokenIds.includes(token.id),
    );
    const savedLemmaCount = this.vocabularyService.recordMarks(
      userId,
      passage,
      selectedTokens,
    );

    this.store.saveAttempt({
      id: attempt?.id,
      userId,
      passageId,
      selectedTokenIds: attempt?.selectedTokenIds ?? [],
      completedAt: new Date().toISOString(),
    });

    return {
      completedPassageId: passageId,
      savedLemmaCount,
      nextPassage: this.getRandomPassage(userId, passageId),
    };
  }
}
