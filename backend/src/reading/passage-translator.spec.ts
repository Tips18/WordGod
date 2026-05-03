import { PassageRecord } from '../store/store.types';
import {
  PassageTranslator,
  UNAVAILABLE_TRANSLATION,
} from './passage-translator';

const PLACEHOLDER_TRANSLATION =
  '内置种子段落提供真实英文原文；逐句中文翻译将在内容富化入库后补齐。';

/**
 * `createPassage` 构造运行时翻译服务测试使用的段落实体。
 */
function createPassage(translation = PLACEHOLDER_TRANSLATION): PassageRecord {
  return {
    id: 'passage-1',
    examType: 'kaoyan',
    year: 2024,
    paper: '英语一',
    questionType: 'reading',
    passageIndex: 1,
    title: 'Runtime Translation',
    content: 'Obscure theories align with patient practice.',
    sourceUrl: 'https://example.com/passage',
    sourceDomain: 'example.com',
    sentences: [
      {
        index: 0,
        text: 'Obscure theories align with patient practice.',
        translation,
      },
    ],
    tokens: [
      {
        id: 'token-1',
        lemma: 'obscure',
        surface: 'Obscure',
        sentenceIndex: 0,
        partOfSpeech: 'adj.',
        definitionCn: '晦涩的',
        translationCn: translation,
        isWord: true,
      },
    ],
    publishedAt: '2026-05-03T00:00:00.000Z',
  };
}

/**
 * `createOpenAiResponse` 构造 Responses API 的结构化输出响应。
 */
function createOpenAiResponse(translation: string): Response {
  return new Response(
    JSON.stringify({
      output_text: JSON.stringify({
        translations: [{ index: 0, translation }],
      }),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

describe('PassageTranslator', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.OPENAI_TRANSLATION_MODEL = 'gpt-test-translation';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_TRANSLATION_MODEL;
    jest.clearAllMocks();
  });

  it('translates placeholder sentences and syncs token translations', async () => {
    const translation = '晦涩的理论与耐心实践保持一致。';

    jest
      .mocked(global.fetch)
      .mockResolvedValueOnce(createOpenAiResponse(translation));

    const translator = new PassageTranslator();
    const translated = await translator.translatePassage(createPassage());
    const fetchMock = jest.mocked(global.fetch);
    const requestInit = fetchMock.mock.calls[0][1];

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.openai.com/v1/responses',
    );
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toEqual({
      Authorization: 'Bearer test-api-key',
      'Content-Type': 'application/json',
    });
    expect(translated.sentences[0].translation).toBe(translation);
    expect(translated.tokens[0].translationCn).toBe(translation);

    const requestBody = JSON.parse(requestInit?.body as string) as unknown;

    expect(requestBody).toMatchObject({
      model: 'gpt-test-translation',
      text: { format: { type: 'json_schema' } },
    });
  });

  it('skips OpenAI when the passage already has real translations', async () => {
    const passage = createPassage('晦涩的理论与实践保持一致。');
    const translator = new PassageTranslator();
    const translated = await translator.translatePassage(passage);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(translated).toEqual(passage);
  });

  it('keeps reading usable with explicit fallback text when API key is missing', async () => {
    delete process.env.OPENAI_API_KEY;

    const translator = new PassageTranslator();
    const translated = await translator.translatePassage(createPassage());

    expect(global.fetch).not.toHaveBeenCalled();
    expect(translated.sentences[0].translation).toBe(UNAVAILABLE_TRANSLATION);
    expect(translated.tokens[0].translationCn).toBe(UNAVAILABLE_TRANSLATION);
  });

  it('keeps reading usable with explicit fallback text when OpenAI fails', async () => {
    jest.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: 'rate limited' } }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const translator = new PassageTranslator();
    const translated = await translator.translatePassage(createPassage());

    expect(translated.sentences[0].translation).toBe(UNAVAILABLE_TRANSLATION);
    expect(translated.tokens[0].translationCn).toBe(UNAVAILABLE_TRANSLATION);
  });

  it('deduplicates concurrent requests and caches successful translations', async () => {
    const translation = '晦涩的理论与耐心实践保持一致。';

    jest
      .mocked(global.fetch)
      .mockResolvedValueOnce(createOpenAiResponse(translation));

    const translator = new PassageTranslator();
    const passage = createPassage();
    const [first, second] = await Promise.all([
      translator.translatePassage(passage),
      translator.translatePassage(passage),
    ]);
    const third = await translator.translatePassage(passage);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(first.sentences[0].translation).toBe(translation);
    expect(second.sentences[0].translation).toBe(translation);
    expect(third.sentences[0].translation).toBe(translation);
  });
});
