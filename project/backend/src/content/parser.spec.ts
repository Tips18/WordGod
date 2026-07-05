import {
  extractPassageSegments,
  ingestNormalizedPassages,
  restoreClozeAnswers,
} from './parser';

describe('content parser', () => {
  it('extracts whitelisted title and paragraph segments from raw html', () => {
    const html = `
      <html>
        <body>
          <article data-source="kaoyan">
            <h1>2024 考研英语 Text 1</h1>
            <p>Obscure theories align with patient practice.</p>
            <p>Obscure archives challenge confident readers.</p>
          </article>
        </body>
      </html>
    `;

    const extracted = extractPassageSegments(
      html,
      'https://example.com/kaoyan/2024/text-1',
    );

    expect(extracted.title).toBe('2024 考研英语 Text 1');
    expect(extracted.paragraphs).toEqual([
      'Obscure theories align with patient practice.',
      'Obscure archives challenge confident readers.',
    ]);
  });

  it('restores cloze answers into the source paragraph before ingestion', () => {
    const restored = restoreClozeAnswers(
      'The [[1|obscure]] archive [[2|reshapes]] memory.',
    );

    expect(restored).toBe('The obscure archive reshapes memory.');
  });

  it('ingests translated paragraphs into passages and lexicon entries', () => {
    const ingested = ingestNormalizedPassages([
      {
        title: '2024 考研英语 Text 1',
        paragraph: 'Obscure theories align with patient practice.',
        translation: '晦涩的理论与耐心的实践保持一致。',
        sourceUrl: 'https://example.com/kaoyan/2024/text-1',
        examType: 'kaoyan',
        year: 2024,
        paper: '英语一',
        questionType: 'reading',
      },
    ]);

    expect(ingested.passages).toHaveLength(1);
    expect(ingested.passages[0].tokens.map((token) => token.lemma)).toContain(
      'obscure',
    );
    expect(ingested.passages[0].sentences[0].translation).toBe(
      '晦涩的理论与耐心的实践保持一致。',
    );
    expect(
      ingested.lexiconEntries.find((entry) => entry.lemma === 'align')
        ?.definitionCn,
    ).toBe('自动释义：align');
  });
});
