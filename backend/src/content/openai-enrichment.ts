import { PassageSentence, PassageToken } from '@word-god/contracts';
import { SelectedWordBankPassage } from './word-bank.parser';

/**
 * `EnrichedPassage` 描述模型返回的段落富化结果。
 */
export interface EnrichedPassage {
  sentences: PassageSentence[];
  tokens: PassageToken[];
}

/**
 * `BatchRequestLine` 描述 OpenAI Batch JSONL 中的一行请求。
 */
export interface BatchRequestLine {
  custom_id: string;
  method: 'POST';
  url: '/v1/responses';
  body: {
    model: string;
    input: Array<{
      role: 'system' | 'user';
      content: string;
    }>;
    text: {
      format: {
        type: 'json_schema';
        name: string;
        strict: true;
        schema: Record<string, unknown>;
      };
    };
  };
}

/**
 * `BatchOutputLine` 描述 OpenAI Batch 输出 JSONL 中的一行响应。
 */
export interface BatchOutputLine {
  custom_id: string;
  response?: {
    status_code: number;
    body?: unknown;
  };
  error?: {
    message?: string;
  };
}

/**
 * `enrichmentSchema` 定义模型必须返回的段落富化 JSON 结构。
 */
export const enrichmentSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['sentences', 'tokens'],
  properties: {
    sentences: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['index', 'text', 'translation'],
        properties: {
          index: { type: 'integer', minimum: 0 },
          text: { type: 'string', minLength: 1 },
          translation: { type: 'string', minLength: 1 },
        },
      },
    },
    tokens: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'lemma',
          'surface',
          'sentenceIndex',
          'partOfSpeech',
          'definitionCn',
          'translationCn',
          'isWord',
        ],
        properties: {
          id: { type: 'string', minLength: 1 },
          lemma: { type: 'string', minLength: 1 },
          surface: { type: 'string', minLength: 1 },
          sentenceIndex: { type: 'integer', minimum: 0 },
          partOfSpeech: { type: 'string', minLength: 1 },
          definitionCn: { type: 'string', minLength: 1 },
          translationCn: { type: 'string', minLength: 1 },
          isWord: { type: 'boolean' },
        },
      },
    },
  },
} as const;

/**
 * `assertObject` 校验未知值是否为普通对象。
 */
function assertObject(value: unknown, message: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
}

/**
 * `validateSentence` 校验单句翻译结果。
 */
function validateSentence(value: unknown, index: number): PassageSentence {
  assertObject(value, `句子 ${index} 结构无效`);

  if (typeof value.text !== 'string' || !value.text.trim()) {
    throw new Error('句子原文不能为空');
  }

  if (typeof value.translation !== 'string' || !value.translation.trim()) {
    throw new Error('句子翻译不能为空');
  }

  return {
    index:
      typeof value.index === 'number' && Number.isInteger(value.index)
        ? value.index
        : index,
    text: value.text.trim(),
    translation: value.translation.trim(),
  };
}

/**
 * `validateToken` 校验单词 token 富化结果。
 */
function validateToken(value: unknown, sentenceCount: number): PassageToken {
  assertObject(value, 'token 结构无效');

  if (
    typeof value.id !== 'string' ||
    typeof value.lemma !== 'string' ||
    typeof value.surface !== 'string' ||
    typeof value.sentenceIndex !== 'number' ||
    !Number.isInteger(value.sentenceIndex)
  ) {
    throw new Error('token 基础字段无效');
  }

  if (value.sentenceIndex < 0 || value.sentenceIndex >= sentenceCount) {
    throw new Error('token 句子索引越界');
  }

  if (
    typeof value.partOfSpeech !== 'string' ||
    !value.partOfSpeech.trim() ||
    typeof value.definitionCn !== 'string' ||
    !value.definitionCn.trim()
  ) {
    throw new Error('token 词性和释义不能为空');
  }

  if (typeof value.translationCn !== 'string' || !value.translationCn.trim()) {
    throw new Error('token 所在句翻译不能为空');
  }

  return {
    id: value.id.trim(),
    lemma: value.lemma.trim().toLowerCase(),
    surface: value.surface.trim(),
    sentenceIndex: value.sentenceIndex,
    partOfSpeech: value.partOfSpeech.trim(),
    definitionCn: value.definitionCn.trim(),
    translationCn: value.translationCn.trim(),
    isWord: typeof value.isWord === 'boolean' ? value.isWord : true,
  };
}

/**
 * `validateEnrichedPassage` 校验模型富化结果是否满足入库要求。
 */
export function validateEnrichedPassage(value: unknown): EnrichedPassage {
  assertObject(value, '富化结果结构无效');

  if (!Array.isArray(value.sentences) || value.sentences.length === 0) {
    throw new Error('句子列表不能为空');
  }

  if (!Array.isArray(value.tokens) || value.tokens.length === 0) {
    throw new Error('token 列表不能为空');
  }

  const sentences = value.sentences.map(validateSentence);
  const tokens = value.tokens.map((token) =>
    validateToken(token, sentences.length),
  );

  return {
    sentences,
    tokens,
  };
}

/**
 * `buildBatchRequestLine` 为一个抽中段落创建 OpenAI Batch 请求行。
 */
export function buildBatchRequestLine(
  passage: SelectedWordBankPassage,
  model: string,
): BatchRequestLine {
  return {
    custom_id: passage.id,
    method: 'POST',
    url: '/v1/responses',
    body: {
      model,
      input: [
        {
          role: 'system',
          content:
            '你是考研英语内容标注助手。请只返回符合 schema 的 JSON，不要添加解释。',
        },
        {
          role: 'user',
          content: [
            `标题：${passage.title}`,
            `英文段落：${passage.content}`,
            '任务：将段落按英文句子切分，提供自然中文翻译；为每个英文单词生成 lemma、词性缩写和中文释义。',
            '要求：token.translationCn 必须等于该 token 所在句子的中文翻译。',
          ].join('\n'),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'word_god_passage_enrichment',
          strict: true,
          schema: enrichmentSchema,
        },
      },
    },
  };
}

/**
 * `extractResponseText` 从 OpenAI 响应体中提取模型文本输出。
 */
function extractResponseText(responseBody: unknown): string {
  assertObject(responseBody, 'OpenAI 响应体无效');

  if (typeof responseBody.output_text === 'string') {
    return responseBody.output_text;
  }

  if (Array.isArray(responseBody.output)) {
    for (const outputItem of responseBody.output) {
      if (!outputItem || typeof outputItem !== 'object') {
        continue;
      }

      const content = (outputItem as { content?: unknown }).content;

      if (!Array.isArray(content)) {
        continue;
      }

      for (const contentItem of content) {
        if (
          contentItem &&
          typeof contentItem === 'object' &&
          typeof (contentItem as { text?: unknown }).text === 'string'
        ) {
          return (contentItem as { text: string }).text;
        }
      }
    }
  }

  throw new Error('OpenAI 响应缺少文本输出');
}

/**
 * `parseBatchOutputLine` 从 OpenAI Batch 输出行中解析并校验富化结果。
 */
export function parseBatchOutputLine(line: string): { passageId: string; enriched: EnrichedPassage } {
  const payload = JSON.parse(line) as BatchOutputLine;

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  if (!payload.response || payload.response.status_code >= 400) {
    throw new Error(`OpenAI Batch 响应失败：${payload.custom_id}`);
  }

  const responseText = extractResponseText(payload.response.body);
  const parsed = JSON.parse(responseText) as unknown;

  return {
    passageId: payload.custom_id,
    enriched: validateEnrichedPassage(parsed),
  };
}
