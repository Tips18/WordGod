import { VocabularyService } from './vocabulary.service';
import { InMemoryAppStore } from '../store/in-memory-app.store';

describe('VocabularyService', () => {
  it('sorts items by mark count first and latest marked time second', async () => {
    const store = new InMemoryAppStore({
      vocabularyEntries: [
        {
          id: 'v-1',
          userId: 'user-1',
          lemma: 'abandon',
          surface: 'abandon',
          partOfSpeech: 'v.',
          definitionCn: '放弃',
          markCount: 2,
          lastMarkedAt: '2026-04-20T00:00:00.000Z',
        },
        {
          id: 'v-2',
          userId: 'user-1',
          lemma: 'align',
          surface: 'align',
          partOfSpeech: 'v.',
          definitionCn: '使一致',
          markCount: 3,
          lastMarkedAt: '2026-04-19T00:00:00.000Z',
        },
        {
          id: 'v-3',
          userId: 'user-1',
          lemma: 'obscure',
          surface: 'obscure',
          partOfSpeech: 'adj.',
          definitionCn: '晦涩的',
          markCount: 2,
          lastMarkedAt: '2026-04-21T00:00:00.000Z',
        },
      ],
    });
    const service = new VocabularyService(store);

    const list = await service.listForUser('user-1');

    expect(list.items.map((item) => item.lemma)).toEqual([
      'align',
      'obscure',
      'abandon',
    ]);
  });
});
