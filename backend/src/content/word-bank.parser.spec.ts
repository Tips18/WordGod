import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractReadingTextCandidates,
  selectWordBankPassages,
} from './word-bank.parser';

const englishOneArticleRoot = join(
  process.cwd(),
  '..',
  '真题题库',
  'wordcram-kaoyan',
  'articles',
);
const englishTwoArticleRoot = join(
  process.cwd(),
  '..',
  '真题题库',
  'kaoyan-english-ii',
  'articles',
);

/**
 * `readEnglishOneArticleFile` 读取仓库中的英语一文章 Markdown 样本。
 */
function readEnglishOneArticleFile(fileName: string): string {
  return readFileSync(join(englishOneArticleRoot, fileName), 'utf8');
}

/**
 * `readEnglishTwoArticleFile` 读取仓库中的英语二文章 Markdown 样本。
 */
function readEnglishTwoArticleFile(fileName: string): string {
  return readFileSync(join(englishTwoArticleRoot, fileName), 'utf8');
}

describe('word bank parser', () => {
  it('extracts WordCram article paragraphs as the smallest passage unit', () => {
    const document = readEnglishOneArticleFile(
      '2026-kaoyan-english-i-articles.md',
    );
    const extracted = extractReadingTextCandidates(
      document,
      '2026-kaoyan-english-i-articles.md',
    );

    expect(extracted.year).toBe(2026);
    expect(extracted.paper).toBe('英语一');
    expect(extracted.texts).toHaveLength(4);
    expect(extracted.texts.map((text) => text.textIndex)).toEqual([1, 2, 3, 4]);
    expect(extracted.sourceUrl).toBe(
      'https://wordcram.com.cn/tests/kaoyan/2026',
    );
    expect(extracted.texts[0].paragraphs[0]).toBe(
      "For thousands of years, donkeys have been critical for propelling human civilizations forward. They've helped pull wheeled vehicles, carry travelers and move goods across the world. But where and when these animals first became intertwined with humans has been a mystery. Now, researchers have used genomes of over 200 donkeys to trace their domestication back to a single event around 7,000 years ago in East Africa - about 3,000 years before humans tamed horses. The team published their findings in the journal Science this month.",
    );
    expect(extracted.texts[0].paragraphs[0]).not.toContain('Through their DNA');
  });

  it('keeps missing WordCram texts as warnings instead of failing extraction', () => {
    const document = readEnglishOneArticleFile(
      '2022-kaoyan-english-i-articles.md',
    );
    const extracted = extractReadingTextCandidates(
      document,
      '2022-kaoyan-english-i-articles.md',
    );

    expect(extracted.texts.map((text) => text.textIndex)).toEqual([2, 3, 4]);
    expect(extracted.warnings).toEqual([
      '2022-kaoyan-english-i-articles.md 缺少 Text 1',
    ]);
  });

  it('keeps standalone numeric line breaks inside WordCram paragraphs', () => {
    const document = readEnglishOneArticleFile(
      '2018-kaoyan-english-i-articles.md',
    );
    const extracted = extractReadingTextCandidates(
      document,
      '2018-kaoyan-english-i-articles.md',
    );
    const textFour = extracted.texts.find((text) => text.textIndex === 4);

    expect(textFour?.paragraphs).toHaveLength(4);
    expect(textFour?.paragraphs[3]).toContain('accounts for 80 percent');
    expect(textFour?.paragraphs[3]).not.toMatch(/^percent\b/);
  });

  it('builds a stable passage for every paragraph in each WordCram text', () => {
    const document = readEnglishOneArticleFile(
      '2026-kaoyan-english-i-articles.md',
    );
    const extracted = extractReadingTextCandidates(
      document,
      '2026-kaoyan-english-i-articles.md',
    );
    const selected = selectWordBankPassages(extracted);

    expect(selected).toHaveLength(22);
    expect(selected[0]).toMatchObject({
      id: 'kaoyan-2026-english-i-reading-text-1',
      examType: 'kaoyan',
      year: 2026,
      paper: '英语一',
      questionType: 'reading',
      passageIndex: 1,
      textIndex: 1,
      paragraphIndex: 1,
    });
    expect(selected[0].content).toBe(extracted.texts[0].paragraphs[0]);
    expect(selected[1]).toMatchObject({
      id: 'kaoyan-2026-english-i-reading-text-1-paragraph-2',
      passageIndex: 1,
      textIndex: 1,
      paragraphIndex: 2,
    });
  });

  it('extracts English II Text 1-4 paragraphs without the cloze section', () => {
    const document = readEnglishTwoArticleFile(
      '2026-kaoyan-english-ii-articles.md',
    );
    const extracted = extractReadingTextCandidates(
      document,
      '2026-kaoyan-english-ii-articles.md',
    );
    const selected = selectWordBankPassages(extracted);

    expect(extracted.year).toBe(2026);
    expect(extracted.paper).toBe('英语二');
    expect(extracted.texts.map((text) => text.textIndex)).toEqual([1, 2, 3, 4]);
    expect(extracted.sourceUrl).toBe(
      'https://zhenti.burningvocabulary.cn/kaoyan/2026/02',
    );
    expect(selected).toHaveLength(28);
    expect(selected[0]).toMatchObject({
      id: 'kaoyan-2026-english-ii-reading-text-1',
      paper: '英语二',
      sourceDomain: 'zhenti.burningvocabulary.cn',
      textIndex: 1,
      paragraphIndex: 1,
    });
    expect(
      selected.some((passage) => passage.content.includes('____(1)____')),
    ).toBe(false);
  });
});
