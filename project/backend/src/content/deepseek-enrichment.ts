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
 * `DeepSeekBatchRequestLine` 描述本地 DeepSeek JSONL 队列中的一行请求。
 */
export interface DeepSeekBatchRequestLine {
  custom_id: string;
  method: 'POST';
  url: '/chat/completions';
  body: {
    model: string;
    messages: Array<{
      role: 'system' | 'user';
      content: string;
    }>;
    response_format: {
      type: 'json_object';
    };
  };
}

/**
 * `DeepSeekBatchOutputLine` 描述本地 DeepSeek JSONL 输出中的一行响应。
 */
export interface DeepSeekBatchOutputLine {
  custom_id: string;
  response?: {
    status_code: number;
    body?: unknown;
  };
  error?: {
    message?: string;
  };
}

export type BatchRequestLine = DeepSeekBatchRequestLine;
export type BatchOutputLine = DeepSeekBatchOutputLine;

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

const DEEPSEEK_ENRICHMENT_SYSTEM_PROMPT =
  '你是考研英语内容标注助手。只返回合法 JSON，不添加解释、Markdown 或额外文本。';

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
 * `buildDeepSeekUserPrompt` 为单个段落生成 DeepSeek 富化提示词。
 */
function buildDeepSeekUserPrompt(passage: SelectedWordBankPassage): string {
  return [
    `标题：${passage.title}`,
    `英文段落：${passage.content}`,
    '任务：将段落按英文句子切分，提供自然中文翻译；为每个英文单词生成 lemma、词性缩写和中文释义。',
    '要求：sentences[].translation 字段必须是中文译文，不得返回英文原句。',
    '要求：tokens[].translationCn 字段必须等于该 token 所在句子的中文译文，不得返回英文原句。',
    '要求：tokens[].definitionCn 字段必须是该 lemma 在上下文中的中文释义。',
    '返回 JSON 格式必须是 {"sentences":[{"index":0,"text":"...","translation":"..."}],"tokens":[{"id":"token-0-example","lemma":"example","surface":"example","sentenceIndex":0,"partOfSpeech":"n.","definitionCn":"例子","translationCn":"...","isWord":true}]}。',
  ].join('\n');
}

/**
 * `buildBatchRequestLine` 为一个抽中段落创建 DeepSeek 本地队列请求行。
 */
export function buildBatchRequestLine(
  passage: SelectedWordBankPassage,
  model: string,
): DeepSeekBatchRequestLine {
  return {
    custom_id: passage.id,
    method: 'POST',
    url: '/chat/completions',
    body: {
      model,
      messages: [
        {
          role: 'system',
          content: DEEPSEEK_ENRICHMENT_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildDeepSeekUserPrompt(passage),
        },
      ],
      response_format: {
        type: 'json_object',
      },
    },
  };
}

/**
 * `extractDeepSeekResponseText` 从 DeepSeek 响应体中提取模型 JSON 文本。
 */
function extractDeepSeekResponseText(responseBody: unknown): string {
  assertObject(responseBody, 'DeepSeek 响应体无效');

  if (!Array.isArray(responseBody.choices)) {
    throw new Error('DeepSeek 响应缺少 choices');
  }

  for (const choice of responseBody.choices) {
    if (!choice || typeof choice !== 'object') {
      continue;
    }

    const message = (choice as { message?: unknown }).message;

    if (
      message &&
      typeof message === 'object' &&
      typeof (message as { content?: unknown }).content === 'string'
    ) {
      return (message as { content: string }).content;
    }
  }

  throw new Error('DeepSeek 响应缺少文本输出');
}

/**
 * `parseBatchOutputLine` 从 DeepSeek 本地输出行中解析并校验富化结果。
 */
export function parseBatchOutputLine(line: string): {
  passageId: string;
  enriched: EnrichedPassage;
} {
  const payload = JSON.parse(line) as DeepSeekBatchOutputLine;

  if (payload.error?.message) {
    throw new Error(payload.error.message);
  }

  if (!payload.response || payload.response.status_code >= 400) {
    throw new Error(`DeepSeek 批处理响应失败：${payload.custom_id}`);
  }

  const responseText = extractDeepSeekResponseText(payload.response.body);
  const parsed = JSON.parse(responseText) as unknown;

  return {
    passageId: payload.custom_id,
    enriched: validateEnrichedPassage(parsed),
  };
}
