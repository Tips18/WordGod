import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassageToken } from '@word-god/contracts';
import {
  EcdictDictionaryService,
  parseEcdictMarkdownFile,
} from './ecdict-dictionary.service';
import type { AppStore } from '../store/app-store';

/**
 * `createToken` 构造词典补全测试使用的 token。
 */
function createToken(
  token: Partial<PassageToken> & Pick<PassageToken, 'id' | 'lemma' | 'surface'>,
): PassageToken {
  return {
    sentenceIndex: 0,
    partOfSpeech: 'n.',
    definitionCn: '原始释义',
    translationCn: '原句翻译',
    isWord: true,
    ...token,
  };
}

describe('EcdictDictionaryService', () => {
  let tempDirectory: string;
  let dictionaryPath: string;
  let previousDictionaryPath: string | undefined;

  beforeEach(async () => {
    previousDictionaryPath = process.env.ECDICT_MARKDOWN_PATH;
    tempDirectory = await mkdtemp(join(tmpdir(), 'word-god-ecdict-'));
    dictionaryPath = join(tempDirectory, 'ecdict.md');
    await writeFile(
      dictionaryPath,
      [
        '# ECDICT 英汉词典',
        '',
        '## align',
        '',
        '- 词性: `v.`',
        '- 中文释义:',
        '  - vt. 使结盟；使一致',
        '  - vi. 排列；排成一线',
        '',
        '## obscure',
        '',
        '- 中文释义:',
        '  - adj. 晦涩的；不清楚的',
        '',
      ].join('\n'),
      'utf8',
    );
    process.env.ECDICT_MARKDOWN_PATH = dictionaryPath;
  });

  afterEach(async () => {
    if (previousDictionaryPath === undefined) {
      delete process.env.ECDICT_MARKDOWN_PATH;
    } else {
      process.env.ECDICT_MARKDOWN_PATH = previousDictionaryPath;
    }

    await rm(tempDirectory, { force: true, recursive: true });
  });

  it('parses Chinese definitions from an ECDICT Markdown file', async () => {
    const entries = await parseEcdictMarkdownFile(dictionaryPath);

    expect(entries.get('align')).toEqual({
      word: 'align',
      partOfSpeech: 'v.',
      definitionCn: 'vt. 使结盟；使一致；vi. 排列；排成一线',
    });
  });

  it('enriches tokens by lemma and keeps original values when no entry exists', async () => {
    const service = new EcdictDictionaryService();

    const tokens = await service.enrichTokens([
      createToken({
        id: 'token-1-align',
        lemma: 'align',
        surface: 'Align',
      }),
      createToken({
        id: 'token-2-missing',
        lemma: 'missing',
        surface: 'Missing',
      }),
      createToken({
        id: 'token-3-obscure',
        lemma: 'obscure',
        surface: 'Obscure',
      }),
    ]);

    expect(tokens[0].partOfSpeech).toBe('v.');
    expect(tokens[0].definitionCn).toBe(
      'vt. 使结盟；使一致；vi. 排列；排成一线',
    );
    expect(tokens[1].definitionCn).toBe('原始释义');
    expect(tokens[2].partOfSpeech).toBe('adj.');
    expect(tokens[2].definitionCn).toBe('adj. 晦涩的；不清楚的');
  });

  it('prefers persisted lexicon entries before reading Markdown fallback entries', async () => {
    const store = {
      findLexiconEntry: jest.fn((lemma: string) =>
        lemma === 'align'
          ? {
              id: 'lexicon-align',
              lemma: 'align',
              surface: 'align',
              partOfSpeech: 'db-v.',
              definitionCn: '数据库释义优先',
              inflections: [],
            }
          : undefined,
      ),
    } as unknown as AppStore;
    const service = new EcdictDictionaryService(store);

    const tokens = await service.enrichTokens([
      createToken({
        id: 'token-1-align',
        lemma: 'align',
        surface: 'Align',
      }),
    ]);

    expect(tokens[0].partOfSpeech).toBe('db-v.');
    expect(tokens[0].definitionCn).toBe('数据库释义优先');
  });
});
