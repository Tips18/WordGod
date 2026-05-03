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
  it('loads one reading passage for every collected kaoyan English text', () => {
    const passageIds = new Set(seedPassages.map((passage) => passage.id));
    const paperCounts = countByPaper();

    expect(seedPassages).toHaveLength(56);
    expect(passageIds.size).toBe(seedPassages.length);
    expect(paperCounts.get('英语一')).toBe(28);
    expect(paperCounts.get('英语二')).toBe(28);
    expect(
      seedPassages.every(
        (passage) =>
          passage.content.split(/\s+/).filter(Boolean).length >= 20 &&
          passage.tokens.length > 0,
      ),
    ).toBe(true);
  });
});
