import { randomUUID } from 'node:crypto';
import { PassageSentence, PassageToken } from '@word-god/contracts';
import { LexiconEntryRecord, PassageRecord } from '../store/store.types';

export interface ExtractedPassageSegments {
  title: string;
  paragraphs: string[];
}

export interface NormalizedPassageInput {
  title: string;
  paragraph: string;
  translation: string;
  sourceUrl: string;
  examType: 'kaoyan';
  year: number;
  paper: string;
  questionType: 'reading' | 'cloze';
}

export interface IngestedPassagePayload {
  passages: PassageRecord[];
  lexiconEntries: LexiconEntryRecord[];
}

/**
 * `stripHtml` 去掉简单 HTML 标签并清理多余空白。
 */
function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * `guessPartOfSpeech` 为当前 token 生成一个轻量级词性猜测。
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
    surface.endsWith('ies')
  ) {
    return 'n.';
  }

  return 'adj.';
}

/**
 * `createTokens` 将段落文本切分为可点击 token 列表。
 */
function createTokens(paragraph: string, translation: string): PassageToken[] {
  return paragraph
    .split(/\s+/)
    .map((surface) => surface.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, ''))
    .filter(Boolean)
    .map((surface, index) => ({
      id: `token-${index}-${surface.toLowerCase()}`,
      lemma: surface.toLowerCase(),
      surface,
      sentenceIndex: 0,
      partOfSpeech: guessPartOfSpeech(surface.toLowerCase()),
      definitionCn: `自动释义：${surface.toLowerCase()}`,
      translationCn: translation,
      isWord: true,
    }));
}

/**
 * `extractPassageSegments` 从白名单 HTML 中提取标题与段落列表。
 */
export function extractPassageSegments(
  html: string,
  sourceUrl: string,
): ExtractedPassageSegments {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const paragraphMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  const title = stripHtml(titleMatch?.[1] ?? sourceUrl);
  const paragraphs = paragraphMatches
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);

  return {
    title,
    paragraphs,
  };
}

/**
 * `restoreClozeAnswers` 将完形填空占位符恢复为完整单词。
 */
export function restoreClozeAnswers(paragraph: string): string {
  return paragraph.replace(/\[\[\d+\|([^\]]+)\]\]/g, '$1');
}

/**
 * `ingestNormalizedPassages` 将规范化段落转成段落实体与词典产物。
 */
export function ingestNormalizedPassages(
  inputs: NormalizedPassageInput[],
): IngestedPassagePayload {
  const lexiconMap = new Map<string, LexiconEntryRecord>();
  const passages = inputs.map((input, index) => {
    const restoredParagraph = restoreClozeAnswers(input.paragraph);
    const sentences: PassageSentence[] = [
      {
        index: 0,
        text: restoredParagraph,
        translation: input.translation,
      },
    ];
    const tokens = createTokens(restoredParagraph, input.translation);

    for (const token of tokens) {
      if (!lexiconMap.has(token.lemma)) {
        lexiconMap.set(token.lemma, {
          id: randomUUID(),
          lemma: token.lemma,
          surface: token.surface,
          partOfSpeech: token.partOfSpeech,
          definitionCn: token.definitionCn,
          inflections: [],
        });
      }
    }

    return {
      id: `ingested-${index + 1}`,
      examType: input.examType,
      year: input.year,
      paper: input.paper,
      questionType: input.questionType,
      passageIndex: index + 1,
      title: input.title,
      content: restoredParagraph,
      sourceUrl: input.sourceUrl,
      sourceDomain: new URL(input.sourceUrl).hostname,
      sentences,
      tokens,
      publishedAt: new Date().toISOString(),
    } satisfies PassageRecord;
  });

  return {
    passages,
    lexiconEntries: [...lexiconMap.values()],
  };
}
