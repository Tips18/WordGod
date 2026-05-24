import { seedPassages } from './seed-passages';

/**
 * `countByPaper` 统计内置题库中每个试卷类型的段落数。
 */
function countByPaper(): Map<string, number> {
  const counts = new Map<string, number>();

  for (const passage of seedPassages) {
    counts.set(passage.paper, (counts.get(passage.paper) ?? 0) + 1);
  }

  return counts;
}

describe('seedPassages', () => {
  it('loads English I and English II article paragraphs as the memory-mode reading bank', () => {
    const passageIds = new Set(seedPassages.map((passage) => passage.id));
    const paperCounts = countByPaper();

    expect(seedPassages).toHaveLength(1021);
    expect(passageIds.size).toBe(seedPassages.length);
    expect(paperCounts.get('英语一')).toBe(654);
    expect(paperCounts.get('英语二')).toBe(367);
    expect(seedPassages[0]).toMatchObject({
      id: 'kaoyan-1998-english-i-reading-text-1',
      textIndex: 1,
      paragraphIndex: 1,
    });
    expect(
      seedPassages.some(
        (passage) =>
          passage.id === 'kaoyan-2026-english-i-reading-text-1-paragraph-2',
      ),
    ).toBe(true);
    expect(
      seedPassages.some(
        (passage) => passage.id === 'kaoyan-2026-english-ii-reading-text-1',
      ),
    ).toBe(true);
    expect(
      seedPassages.every(
        (passage) =>
          passage.content.split(/\s+/).filter(Boolean).length >= 20 &&
          passage.tokens.length > 0 &&
          !passage.content.includes('____(1)____'),
      ),
    ).toBe(true);
  });
});
