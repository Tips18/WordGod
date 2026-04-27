import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getVocabularyDetail } from '../api/client';

/**
 * `VocabularyDetailPage` 展示单个 lemma 的上下文细节。
 */
export function VocabularyDetailPage() {
  const navigate = useNavigate();
  const { lemma = '' } = useParams();
  const detailQuery = useQuery({
    queryKey: ['vocabulary-detail', lemma],
    queryFn: () => getVocabularyDetail(lemma),
    retry: false,
  });

  useEffect(() => {
    if (detailQuery.isError) {
      navigate(`/auth?redirect=/vocabulary/${lemma}`, { replace: true });
    }
  }, [detailQuery.isError, lemma, navigate]);

  if (detailQuery.isError) {
    return null;
  }

  if (detailQuery.isLoading) {
    return (
      <section className="rounded-[2rem] border border-stone-900/10 bg-white/80 p-8 text-stone-600 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
        正在载入词条详情...
      </section>
    );
  }

  const item = detailQuery.data?.item;

  if (!item) {
    return null;
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
      <aside className="rounded-[2rem] border border-stone-900/10 bg-white/85 p-8 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
        <Link className="text-sm text-stone-500 transition hover:text-stone-900" to="/vocabulary">
          ← 返回生词本
        </Link>
        <div className="mt-6 space-y-4">
          <h2 className="font-[Iowan_Old_Style,Palatino_Linotype,Book_Antiqua,Georgia,serif] text-4xl text-stone-950">
            {item.surface}
          </h2>
          <p className="text-sm text-stone-600">
            {item.partOfSpeech} · {item.definitionCn}
          </p>
          <div className="rounded-[1.5rem] bg-[var(--paper-muted)] p-5 text-sm text-stone-700">
            已累计标记 <span className="font-semibold text-stone-950">{item.markCount}</span> 次
          </div>
        </div>
      </aside>

      <section className="rounded-[2rem] border border-stone-900/10 bg-white/85 p-8 shadow-[0_18px_60px_rgba(74,39,24,0.12)]">
        <p className="text-xs uppercase tracking-[0.32em] text-stone-500">Recent Contexts</p>
        <div className="mt-6 space-y-4">
          {item.contexts.map((context) => (
            <article className="rounded-[1.5rem] border border-stone-900/10 bg-[var(--paper-muted)] p-5" key={`${context.passageId}-${context.markedAt}`}>
              <p className="text-xs uppercase tracking-[0.2em] text-stone-500">{context.passageId}</p>
              <p className="mt-3 text-base leading-8 text-stone-900">{context.sentenceText}</p>
              <p className="mt-3 text-sm leading-7 text-stone-600">{context.sentenceTranslation}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
