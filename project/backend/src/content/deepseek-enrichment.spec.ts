import {
  buildBatchRequestLine,
  parseBatchOutputLine,
  validateEnrichedPassage,
} from './deepseek-enrichment';
import { SelectedWordBankPassage } from './word-bank.parser';

describe('DeepSeek enrichment validation', () => {
  it('builds DeepSeek chat completion request lines', () => {
    const passage: SelectedWordBankPassage = {
      id: 'kaoyan-2026-english-i-reading-text-1',
      examType: 'kaoyan',
      year: 2026,
      paper: '英语一',
      questionType: 'reading',
      passageIndex: 1,
      textIndex: 1,
      paragraphIndex: 1,
      title: '2026 英语一 Text 1',
      content: 'People often complain that plastics are too durable.',
      sourceUrl: 'https://wordcram.com.cn/tests/kaoyan/2026',
      sourceDomain: 'wordcram.com.cn',
      publishedAt: '2026-01-01T00:00:00.000Z',
    };

    const line = buildBatchRequestLine(passage, 'deepseek-v4-flash');

    expect(line.custom_id).toBe(passage.id);
    expect(line.method).toBe('POST');
    expect(line.url).toBe('/chat/completions');
    expect(line.body.model).toBe('deepseek-v4-flash');
    expect(line.body.response_format).toEqual({ type: 'json_object' });
    expect(line.body.messages[0]).toMatchObject({ role: 'system' });
    expect(line.body.messages[1]?.content).toContain(
      'translation 字段必须是中文译文',
    );
    expect(line.body.messages[1]?.content).toContain(passage.content);
  });

  it('accepts enriched passages with translated sentences and token definitions', () => {
    const enriched = validateEnrichedPassage({
      sentences: [
        {
          index: 0,
          text: 'People often complain that plastics are too durable.',
          translation: '人们常常抱怨塑料太耐用了。',
        },
      ],
      tokens: [
        {
          id: 'token-0-people',
          lemma: 'people',
          surface: 'People',
          sentenceIndex: 0,
          partOfSpeech: 'n.',
          definitionCn: '人们',
          translationCn: '人们常常抱怨塑料太耐用了。',
          isWord: true,
        },
        {
          id: 'token-1-complain',
          lemma: 'complain',
          surface: 'complain',
          sentenceIndex: 0,
          partOfSpeech: 'v.',
          definitionCn: '抱怨',
          translationCn: '人们常常抱怨塑料太耐用了。',
          isWord: true,
        },
      ],
    });

    expect(enriched.tokens.map((token) => token.definitionCn)).toEqual([
      '人们',
      '抱怨',
    ]);
  });

  it('parses DeepSeek chat completion output lines', () => {
    const modelOutput = {
      sentences: [
        {
          index: 0,
          text: 'People often complain that plastics are too durable.',
          translation: '人们常常抱怨塑料太耐用了。',
        },
      ],
      tokens: [
        {
          id: 'token-0-people',
          lemma: 'people',
          surface: 'People',
          sentenceIndex: 0,
          partOfSpeech: 'n.',
          definitionCn: '人们',
          translationCn: '人们常常抱怨塑料太耐用了。',
          isWord: true,
        },
      ],
    };
    const line = JSON.stringify({
      custom_id: 'kaoyan-2026-english-i-reading-text-1',
      response: {
        status_code: 200,
        body: {
          choices: [
            {
              message: {
                content: JSON.stringify(modelOutput),
              },
            },
          ],
        },
      },
    });

    const parsed = parseBatchOutputLine(line);

    expect(parsed.passageId).toBe('kaoyan-2026-english-i-reading-text-1');
    expect(parsed.enriched.sentences[0]?.translation).toBe(
      '人们常常抱怨塑料太耐用了。',
    );
  });

  it('rejects enrichment output with missing translations or token definitions', () => {
    expect(() =>
      validateEnrichedPassage({
        sentences: [
          {
            index: 0,
            text: 'People often complain that plastics are too durable.',
            translation: '',
          },
        ],
        tokens: [
          {
            id: 'token-0-people',
            lemma: 'people',
            surface: 'People',
            sentenceIndex: 0,
            partOfSpeech: 'n.',
            definitionCn: '人们',
            translationCn: '',
            isWord: true,
          },
        ],
      }),
    ).toThrow('句子翻译不能为空');

    expect(() =>
      validateEnrichedPassage({
        sentences: [
          {
            index: 0,
            text: 'People often complain that plastics are too durable.',
            translation: '人们常常抱怨塑料太耐用了。',
          },
        ],
        tokens: [
          {
            id: 'token-0-people',
            lemma: 'people',
            surface: 'People',
            sentenceIndex: 0,
            partOfSpeech: '',
            definitionCn: '',
            translationCn: '人们常常抱怨塑料太耐用了。',
            isWord: true,
          },
        ],
      }),
    ).toThrow('token 词性和释义不能为空');
  });
});
