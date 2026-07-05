import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listVocabulary } from '../api/client';

interface VocabularyPageProps {
  authRevision: number;
  onAuthRequired?: (message?: string) => void;
}

/**
 * `VocabularyPage` 展示当前用户的生词本列表。
 */
export function VocabularyPage({
  authRevision,
  onAuthRequired,
}: VocabularyPageProps) {
  const vocabularyQuery = useQuery({
    queryKey: ['vocabulary-list', authRevision],
    queryFn: listVocabulary,
    retry: false,
  });

  useEffect(() => {
    if (vocabularyQuery.isError) {
      onAuthRequired?.('生词本需要登录后查看。');
    }
  }, [onAuthRequired, vocabularyQuery.isError]);

  if (vocabularyQuery.isError) {
    return (
      <section className="rounded-[2rem] border border-stone-900/10 bg-white/80 p-8 text-stone-600 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
        生词本需要登录后查看。
      </section>
    );
  }

  if (vocabularyQuery.isLoading) {
    return (
      <section className="rounded-[2rem] border border-stone-900/10 bg-white/80 p-8 text-stone-600 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
        正在整理你的生词本...
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-stone-900/10 bg-white/85 p-5 shadow-[0_18px_60px_rgba(74,39,24,0.12)] sm:rounded-[2rem] sm:p-8">
      <ul className="space-y-4">
        {vocabularyQuery.data?.items.map((item) => (
          <li
            className="rounded-[1.25rem] border border-stone-900/10 bg-[var(--paper-muted)] p-4 transition hover:border-stone-900/20 sm:rounded-[1.5rem] sm:p-5"
            key={item.lemma}
          >
            <Link className="flex items-start justify-between gap-3 sm:gap-4" to={`/vocabulary/${item.lemma}`}>
              <div className="min-w-0 flex-1">
                <p className="font-[Iowan_Old_Style,Palatino_Linotype,Book_Antiqua,Georgia,serif] text-xl text-stone-950 sm:text-2xl">
                  {item.surface}
                </p>
                <p className="mt-1.5 break-words text-xs leading-6 text-stone-600 sm:mt-2 sm:text-sm">
                  {item.partOfSpeech} · {item.definitionCn}
                </p>
              </div>
              <div className="vocabulary-mark-count-badge flex h-8 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[0.7rem] font-semibold leading-none text-white sm:h-9 sm:w-14 sm:text-xs">
                {item.markCount} 次
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
