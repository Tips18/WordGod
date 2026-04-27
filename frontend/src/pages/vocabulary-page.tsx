import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listVocabulary } from '../api/client';

/**
 * `VocabularyPage` 展示当前用户的生词本列表。
 */
export function VocabularyPage() {
  const navigate = useNavigate();
  const vocabularyQuery = useQuery({
    queryKey: ['vocabulary-list'],
    queryFn: listVocabulary,
    retry: false,
  });

  useEffect(() => {
    if (vocabularyQuery.isError) {
      navigate('/auth?redirect=/vocabulary', { replace: true });
    }
  }, [navigate, vocabularyQuery.isError]);

  if (vocabularyQuery.isError) {
    return null;
  }

  if (vocabularyQuery.isLoading) {
    return (
      <section className="rounded-[2rem] border border-stone-900/10 bg-white/80 p-8 text-stone-600 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
        正在整理你的生词本...
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <aside className="rounded-[2rem] border border-stone-900/10 bg-white/85 p-8 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
        <p className="text-xs uppercase tracking-[0.32em] text-stone-500">Priority List</p>
        <h2 className="mt-4 font-[Iowan_Old_Style,Palatino_Linotype,Book_Antiqua,Georgia,serif] text-4xl text-stone-950">
          生词本
        </h2>
        <p className="mt-4 text-sm leading-7 text-stone-600">
          列表默认按标记次数倒序排列。越常在真题里卡住的词，越应该先复习。
        </p>
      </aside>

      <section className="rounded-[2rem] border border-stone-900/10 bg-white/85 p-8 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
        <ul className="space-y-4">
          {vocabularyQuery.data?.items.map((item) => (
            <li
              className="rounded-[1.5rem] border border-stone-900/10 bg-[var(--paper-muted)] p-5 transition hover:border-stone-900/20"
              key={item.lemma}
            >
              <Link className="flex items-start justify-between gap-4" to={`/vocabulary/${item.lemma}`}>
                <div>
                  <p className="font-[Iowan_Old_Style,Palatino_Linotype,Book_Antiqua,Georgia,serif] text-2xl text-stone-950">
                    {item.surface}
                  </p>
                  <p className="mt-2 text-sm text-stone-600">
                    {item.partOfSpeech} · {item.definitionCn}
                  </p>
                </div>
                <div className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
                  {item.markCount} 次
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
