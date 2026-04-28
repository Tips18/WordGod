import { PassageSentence, PassageToken } from '@word-god/contracts';
import { PassageRecord } from './store.types';

interface SeedPassageInput {
  id: string;
  year: number;
  paper: string;
  passageIndex: number;
  title: string;
  content: string;
  sourceUrl: string;
}

/**
 * `guessPartOfSpeech` 为内置种子 token 生成轻量级词性。
 */
function guessPartOfSpeech(surface: string): string {
  if (surface.endsWith('ly')) {
    return 'adv.';
  }

  if (surface.endsWith('ing') || surface.endsWith('ed')) {
    return 'v.';
  }

  if (
    surface.endsWith('ion') ||
    surface.endsWith('ment') ||
    surface.endsWith('ness') ||
    surface.endsWith('ity')
  ) {
    return 'n.';
  }

  return 'n.';
}

/**
 * `splitSentences` 将内置长段落切成可用于原句展示的句子。
 */
function splitSentences(content: string): PassageSentence[] {
  const sentences = content.match(/[^.!?]+[.!?]+(?:["']+)?/g) ?? [content];

  return sentences.map((sentence, index) => ({
    index,
    text: sentence.trim(),
    translation:
      '内置种子段落提供真实英文原文；逐句中文翻译将在内容富化入库后补齐。',
  }));
}

/**
 * `findSentenceIndex` 查找 token 所在的句子序号。
 */
function findSentenceIndex(
  sentences: PassageSentence[],
  offset: number,
): number {
  let cursor = 0;

  for (const sentence of sentences) {
    cursor += sentence.text.length + 1;

    if (offset < cursor) {
      return sentence.index;
    }
  }

  return Math.max(sentences.length - 1, 0);
}

/**
 * `createTokens` 从真实英文段落生成首页可点击的单词 token。
 */
function createTokens(
  content: string,
  sentences: PassageSentence[],
): PassageToken[] {
  const matches = [...content.matchAll(/[A-Za-z]+(?:['-][A-Za-z]+)*/g)];

  return matches.map((match, index) => {
    const surface = match[0];
    const lemma = surface.toLowerCase();

    return {
      id: `token-${index}-${lemma.replace(/[^a-z0-9]+/g, '-')}`,
      lemma,
      surface,
      sentenceIndex: findSentenceIndex(sentences, match.index ?? 0),
      partOfSpeech: guessPartOfSpeech(lemma),
      definitionCn: `内置释义待富化：${lemma}`,
      translationCn:
        '内置种子段落提供真实英文原文；逐句中文翻译将在内容富化入库后补齐。',
      isWord: true,
    };
  });
}

/**
 * `createSeedPassage` 将真实考研阅读文本转换为内存模式段落实体。
 */
function createSeedPassage(input: SeedPassageInput): PassageRecord {
  const sentences = splitSentences(input.content);

  return {
    id: input.id,
    examType: 'kaoyan',
    year: input.year,
    paper: input.paper,
    questionType: 'reading',
    passageIndex: input.passageIndex,
    title: input.title,
    content: input.content,
    sourceUrl: input.sourceUrl,
    sourceDomain: new URL(input.sourceUrl).hostname,
    sentences,
    tokens: createTokens(input.content, sentences),
    publishedAt: new Date(`${input.year}-01-01T00:00:00.000Z`).toISOString(),
  };
}

/**
 * `seedPassages` 提供内存模式使用的真实考研阅读长段落。
 */
export const seedPassages: PassageRecord[] = [
  createSeedPassage({
    id: 'kaoyan-2022-english-i-reading-text-1',
    year: 2022,
    paper: '英语一',
    passageIndex: 1,
    title: '2022 英语一 Text 1',
    sourceUrl:
      'https://raw.githubusercontent.com/Fantasia1999/kaoyanzhenti/main/2022-english-i.pdf',
    content:
      "People often complain that plastics are too durable. Water bottles, shopping bags, and other trash litter the planet, from Mount Everest to the Mariana Trench, because plastics are everywhere and do not break down easily. But some plastic materials change over time. They crack and frizzle. They weep out additives. They melt into sludge. All of which creates huge headaches for institutions, such as museums, trying to preserve culturally important objects. The variety of plastic objects at risk is dizzying: early radios, avant-garde sculptures, celluloid animation stills from Disney films, and the first artificial heart. Certain artifacts are especially vulnerable because some pioneers in plastic art did not always know how to mix ingredients properly, says Thea van Oosten, a polymer chemist who, until retiring a few years ago, worked for decades at the Cultural Heritage Agency of the Netherlands. It is like baking a cake: if you do not have exact amounts, it goes wrong, she says. The object you make is already a time bomb. And sometimes, it is not the artist's fault. In the 1960s, the Italian artist Piero Gilardi began to create hundreds of bright, colorful foam pieces. Those pieces included small beds of roses and other items as well as a few dozen nature carpets, large rectangles decorated with foam pumpkins, cabbages, and watermelons. He wanted viewers to walk around on the carpets, which meant they had to be durable.",
  }),
  createSeedPassage({
    id: 'kaoyan-2017-english-i-reading-text-1',
    year: 2017,
    paper: '英语一',
    passageIndex: 1,
    title: '2017 英语一 Text 1',
    sourceUrl:
      'https://raw.githubusercontent.com/Fantasia1999/kaoyanzhenti/main/2017-english-i.pdf',
    content:
      "First two hours, now three hours: this is how far in advance authorities are recommending people show up to catch a domestic flight, at least at some major U.S. airports with increasingly massive security lines. Americans are willing to tolerate time-consuming security procedures in return for increased safety. The crash of EgyptAir Flight 804, which terrorists may have downed over the Mediterranean Sea, provides another tragic reminder of why. But demanding too much of air travelers or providing too little security in return undermines public support for the process. And it should: wasted time is a drag on Americans' economic and private lives, not to mention infuriating. Last year, the Transportation Security Administration found in a secret check that undercover investigators were able to sneak weapons, both fake and real, past airport security nearly every time they tried. Enhanced security measures since then, combined with a rise in airline travel due to the improving economy and low oil prices, have resulted in long waits at major airports such as Chicago O'Hare International. It is not yet clear how much more effective airline security has become, but the lines are obvious. Part of the issue is that the government did not anticipate the steep increase in airline travel, so the TSA is now rushing to get new screeners on the line.",
  }),
];
