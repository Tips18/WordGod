import { PassageToken } from '@word-god/contracts';
import { PassageRecord } from './store.types';

/**
 * `createToken` 生成默认题库使用的 token 数据。
 */
function createToken(
  token: Partial<PassageToken> & Pick<PassageToken, 'id' | 'lemma' | 'surface'>,
): PassageToken {
  return {
    sentenceIndex: 0,
    partOfSpeech: 'adj.',
    definitionCn: '默认释义',
    translationCn: '默认翻译',
    isWord: true,
    ...token,
  };
}

/**
 * `seedPassages` 提供应用启动时的默认阅读题库。
 */
export const seedPassages: PassageRecord[] = [
  {
    id: 'passage-1',
    examType: 'kaoyan',
    year: 2024,
    paper: '英语一',
    questionType: 'reading',
    passageIndex: 1,
    title: 'Memory and Method',
    content: 'Obscure theories align with patient practice.',
    sourceUrl: 'https://example.com/kaoyan/2024/1',
    sourceDomain: 'example.com',
    sentences: [
      {
        index: 0,
        text: 'Obscure theories align with patient practice.',
        translation: '晦涩的理论与耐心的实践保持一致。',
      },
    ],
    tokens: [
      createToken({
        id: 'p1-t1',
        lemma: 'obscure',
        surface: 'Obscure',
        definitionCn: '晦涩的',
      }),
      createToken({
        id: 'p1-t2',
        lemma: 'theory',
        surface: 'theories',
        definitionCn: '理论',
        partOfSpeech: 'n.',
      }),
      createToken({
        id: 'p1-t3',
        lemma: 'align',
        surface: 'align',
        definitionCn: '使一致',
        partOfSpeech: 'v.',
      }),
    ],
    publishedAt: '2026-04-26T00:00:00.000Z',
  },
  {
    id: 'passage-2',
    examType: 'kaoyan',
    year: 2023,
    paper: '英语一',
    questionType: 'reading',
    passageIndex: 2,
    title: 'Attention and Choice',
    content: 'Obscure symbols quietly shape collective memory.',
    sourceUrl: 'https://example.com/kaoyan/2023/2',
    sourceDomain: 'example.com',
    sentences: [
      {
        index: 0,
        text: 'Obscure symbols quietly shape collective memory.',
        translation: '晦涩的符号悄然塑造集体记忆。',
      },
    ],
    tokens: [
      createToken({
        id: 'p2-t1',
        lemma: 'obscure',
        surface: 'Obscure',
        definitionCn: '晦涩的',
      }),
      createToken({
        id: 'p2-t2',
        lemma: 'shape',
        surface: 'shape',
        definitionCn: '塑造',
        partOfSpeech: 'v.',
      }),
    ],
    publishedAt: '2026-04-25T00:00:00.000Z',
  },
  {
    id: 'passage-3',
    examType: 'kaoyan',
    year: 2022,
    paper: '英语一',
    questionType: 'reading',
    passageIndex: 3,
    title: 'Archives and Readers',
    content: 'Obscure archives challenge even confident readers.',
    sourceUrl: 'https://example.com/kaoyan/2022/3',
    sourceDomain: 'example.com',
    sentences: [
      {
        index: 0,
        text: 'Obscure archives challenge even confident readers.',
        translation: '晦涩的档案甚至挑战自信的读者。',
      },
    ],
    tokens: [
      createToken({
        id: 'p3-t1',
        lemma: 'obscure',
        surface: 'Obscure',
        definitionCn: '晦涩的',
      }),
      createToken({
        id: 'p3-t2',
        lemma: 'archive',
        surface: 'archives',
        definitionCn: '档案',
        partOfSpeech: 'n.',
      }),
    ],
    publishedAt: '2026-04-24T00:00:00.000Z',
  },
  {
    id: 'passage-4',
    examType: 'kaoyan',
    year: 2021,
    paper: '英语一',
    questionType: 'reading',
    passageIndex: 4,
    title: 'Debate and Policy',
    content: 'Obscure debates slowly reshape public policy.',
    sourceUrl: 'https://example.com/kaoyan/2021/4',
    sourceDomain: 'example.com',
    sentences: [
      {
        index: 0,
        text: 'Obscure debates slowly reshape public policy.',
        translation: '晦涩的争论缓慢地重塑公共政策。',
      },
    ],
    tokens: [
      createToken({
        id: 'p4-t1',
        lemma: 'obscure',
        surface: 'Obscure',
        definitionCn: '晦涩的',
      }),
      createToken({
        id: 'p4-t2',
        lemma: 'reshape',
        surface: 'reshape',
        definitionCn: '重塑',
        partOfSpeech: 'v.',
      }),
    ],
    publishedAt: '2026-04-23T00:00:00.000Z',
  },
];
