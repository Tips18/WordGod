import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractReadingTextCandidates,
  selectWordBankPassages,
} from './word-bank.parser';

const wordBankRoot = join(process.cwd(), '..', '词库');

/**
 * `readWordBankFile` 读取仓库中的词库 Markdown 样本。
 */
function readWordBankFile(fileName: string): string {
  return readFileSync(join(wordBankRoot, fileName), 'utf8');
}

describe('word bank parser', () => {
  it('extracts four reading texts with paragraph candidates from 2022 English I', () => {
    const document = readWordBankFile('kaoyan-english-2022-english-i.md');
    const extracted = extractReadingTextCandidates(
      document,
      'kaoyan-english-2022-english-i.md',
    );

    expect(extracted.year).toBe(2022);
    expect(extracted.paper).toBe('英语一');
    expect(extracted.texts).toHaveLength(4);
    expect(extracted.texts.map((text) => text.textIndex)).toEqual([1, 2, 3, 4]);
    expect(extracted.texts[0].paragraphs.length).toBeGreaterThan(0);
    expect(extracted.texts[0].paragraphs[0]).toContain('People often complain');
  });

  it('extracts four reading texts from 2023 English I despite line-broken PDF text', () => {
    const document = readWordBankFile('kaoyan-english-2023-english-i.md');
    const extracted = extractReadingTextCandidates(
      document,
      'kaoyan-english-2023-english-i.md',
    );

    expect(extracted.texts).toHaveLength(4);
    expect(extracted.texts[0].paragraphs[0]).toContain(
      'The weather in Texas may have cooled',
    );
    expect(extracted.texts[1].paragraphs.join(' ')).toContain('Airbnb');
  });

  it('filters questions, answer choices, page footers, and directions from paragraph candidates', () => {
    const document = readWordBankFile('kaoyan-english-2022-english-i.md');
    const extracted = extractReadingTextCandidates(
      document,
      'kaoyan-english-2022-english-i.md',
    );
    const allParagraphs = extracted.texts.flatMap((text) => text.paragraphs);

    expect(allParagraphs.some((paragraph) => /^21\./.test(paragraph))).toBe(
      false,
    );
    expect(allParagraphs.some((paragraph) => /^\[A\]/.test(paragraph))).toBe(
      false,
    );
    expect(
      allParagraphs.some((paragraph) => paragraph.includes('Directions:')),
    ).toBe(false);
    expect(
      allParagraphs.some((paragraph) => paragraph.includes('第1 页 共')),
    ).toBe(false);
  });

  it('selects one random paragraph per text and builds stable passage ids', () => {
    const document = readWordBankFile('kaoyan-english-2022-english-i.md');
    const extracted = extractReadingTextCandidates(
      document,
      'kaoyan-english-2022-english-i.md',
    );
    const selected = selectWordBankPassages(extracted, () => 0);

    expect(selected).toHaveLength(4);
    expect(selected[0]).toMatchObject({
      id: 'kaoyan-2022-english-i-reading-text-1',
      examType: 'kaoyan',
      year: 2022,
      paper: '英语一',
      questionType: 'reading',
      passageIndex: 1,
    });
    expect(selected[0].content).toBe(extracted.texts[0].paragraphs[0]);
  });
});
