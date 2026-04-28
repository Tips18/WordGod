import { validateEnrichedPassage } from './openai-enrichment';

describe('openai enrichment validation', () => {
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
