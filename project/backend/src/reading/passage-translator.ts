import { Injectable } from '@nestjs/common';
import { PassageRecord } from '../store/store.types';

export const UNAVAILABLE_TRANSLATION = '翻译暂不可用，请稍后重试。';

const DEEPSEEK_CHAT_COMPLETIONS_URL =
  'https://api.deepseek.com/chat/completions';

interface RuntimeTranslationPayload {
  translations: Array<{
    index: number;
    translation: string;
  }>;
}

interface DeepSeekChatCompletionPayload {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

/**
 * `assertObject` 校验未知值是否为普通对象。
 */
function assertObject(
  value: unknown,
  message: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
}

/**
 * `isPlaceholderTranslation` 判断当前译文是否仍是占位内容。
 */
function isPlaceholderTranslation(value: string | undefined): boolean {
  const normalizedValue = value?.trim() ?? '';

  return (
    !normalizedValue ||
    normalizedValue === UNAVAILABLE_TRANSLATION ||
    normalizedValue.startsWith('自动翻译：') ||
    normalizedValue.startsWith('自动翻译:') ||
    normalizedValue.includes('逐句中文翻译将在内容富化入库后补齐') ||
    normalizedValue.includes('内置种子段落提供真实英文原文')
  );
}

/**
 * `needsRuntimeTranslation` 判断段落是否需要运行时补齐真实句子翻译。
 */
function needsRuntimeTranslation(passage: PassageRecord): boolean {
  return passage.sentences.some((sentence) =>
    isPlaceholderTranslation(sentence.translation),
  );
}

/**
 * `createCacheKey` 根据段落主键和正文生成进程内缓存键。
 */
function createCacheKey(passage: PassageRecord): string {
  return `${passage.id}:${passage.content}`;
}

/**
 * `buildTranslationRequestBody` 构造 DeepSeek Chat Completions JSON 请求体。
 */
function buildTranslationRequestBody(
  passage: PassageRecord,
  model: string,
): Record<string, unknown> {
  const sentenceLines = passage.sentences
    .map((sentence) => `${sentence.index}. ${sentence.text}`)
    .join('\n');

  return {
    model,
    messages: [
      {
        role: 'system',
        content:
          '你是考研英语阅读句子翻译助手。只返回 JSON，不添加解释、Markdown 或额外文本。',
      },
      {
        role: 'user',
        content: [
          '请将下列英文句子翻译为自然、准确、适合考研阅读语境的中文。',
          '返回格式必须是 {"translations":[{"index":0,"translation":"中文译文"}]}。',
          'translation 字段必须是中文译文，不得返回英文原句。',
          `标题：${passage.title}`,
          '句子：',
          sentenceLines,
        ].join('\n'),
      },
    ],
    response_format: {
      type: 'json_object',
    },
  };
}

/**
 * `extractResponseText` 从 DeepSeek Chat Completions 响应中提取文本输出。
 */
function extractResponseText(
  responseBody: DeepSeekChatCompletionPayload,
): string {
  const content = responseBody.choices?.[0]?.message?.content;

  if (typeof content === 'string' && content.trim()) {
    return content;
  }

  throw new Error('DeepSeek 响应缺少文本输出');
}

/**
 * `validateTranslationPayload` 校验模型返回的译文结构。
 */
function validateTranslationPayload(value: unknown): RuntimeTranslationPayload {
  assertObject(value, '翻译结果结构无效');

  if (!Array.isArray(value.translations)) {
    throw new Error('翻译结果缺少 translations 数组');
  }

  const translations = value.translations.map((item, position) => {
    assertObject(item, `翻译结果 ${position} 结构无效`);

    if (typeof item.index !== 'number' || !Number.isInteger(item.index)) {
      throw new Error(`翻译结果 ${position} 缺少句子索引`);
    }

    if (typeof item.translation !== 'string' || !item.translation.trim()) {
      throw new Error(`翻译结果 ${position} 缺少中文译文`);
    }

    return {
      index: item.index,
      translation: item.translation.trim(),
    };
  });

  return { translations };
}

/**
 * `applySentenceTranslations` 将句子译文同步到段落句子和 token 上。
 */
function applySentenceTranslations(
  passage: PassageRecord,
  translations: Map<number, string>,
): PassageRecord {
  const sentences = passage.sentences.map((sentence) => ({
    ...sentence,
    translation: translations.get(sentence.index) ?? UNAVAILABLE_TRANSLATION,
  }));
  const sentenceTranslations = new Map(
    sentences.map((sentence) => [sentence.index, sentence.translation]),
  );
  const tokens = passage.tokens.map((token) => ({
    ...token,
    translationCn:
      sentenceTranslations.get(token.sentenceIndex) ?? UNAVAILABLE_TRANSLATION,
  }));

  return {
    ...passage,
    sentences,
    tokens,
  };
}

/**
 * `applyUnavailableTranslation` 为无法翻译的段落写入明确不可用提示。
 */
function applyUnavailableTranslation(passage: PassageRecord): PassageRecord {
  const translations = new Map(
    passage.sentences.map((sentence) => [
      sentence.index,
      UNAVAILABLE_TRANSLATION,
    ]),
  );

  return applySentenceTranslations(passage, translations);
}

/**
 * `PassageTranslator` 在阅读接口返回前通过 DeepSeek 为占位译文段落补齐中文翻译。
 */
@Injectable()
export class PassageTranslator {
  private readonly translationCache = new Map<string, PassageRecord>();
  private readonly pendingTranslations = new Map<
    string,
    Promise<PassageRecord>
  >();

  /**
   * `translatePassage` 返回已补齐真实句子翻译的段落副本。
   */
  async translatePassage(passage: PassageRecord): Promise<PassageRecord> {
    if (!needsRuntimeTranslation(passage)) {
      return passage;
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      return applyUnavailableTranslation(passage);
    }

    const cacheKey = createCacheKey(passage);
    const cachedPassage = this.translationCache.get(cacheKey);

    if (cachedPassage) {
      return cachedPassage;
    }

    const pendingPassage = this.pendingTranslations.get(cacheKey);

    if (pendingPassage) {
      return pendingPassage.catch(() => applyUnavailableTranslation(passage));
    }

    const translationRequest = this.requestTranslation(passage, apiKey)
      .then((translatedPassage) => {
        this.translationCache.set(cacheKey, translatedPassage);
        return translatedPassage;
      })
      .finally(() => {
        this.pendingTranslations.delete(cacheKey);
      });

    this.pendingTranslations.set(cacheKey, translationRequest);

    return translationRequest.catch(() => applyUnavailableTranslation(passage));
  }

  /**
   * `requestTranslation` 调用 DeepSeek Chat Completions API 获取段落句子翻译。
   */
  private async requestTranslation(
    passage: PassageRecord,
    apiKey: string,
  ): Promise<PassageRecord> {
    const response = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        buildTranslationRequestBody(
          passage,
          process.env.DEEPSEEK_TRANSLATION_MODEL ?? 'deepseek-v4-flash',
        ),
      ),
    });
    const payload = (await response.json()) as DeepSeekChatCompletionPayload;

    if (!response.ok) {
      throw new Error(payload.error?.message ?? 'DeepSeek 翻译请求失败');
    }

    const responseText = extractResponseText(payload);
    const parsed = JSON.parse(responseText) as unknown;
    const validated = validateTranslationPayload(parsed);
    const translations = new Map(
      validated.translations.map((item) => [item.index, item.translation]),
    );

    return applySentenceTranslations(passage, translations);
  }
}
