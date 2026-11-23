import { Link, Navigate } from 'react-router-dom';
import type { PathDetail, PathSummary, ProgressRow } from '@sabi/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { hydrateProgress, useOnline } from '../lib/offline';
import { errorMessage, formatDate, percent } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Icon, type IconName } from '../components/Icon';
import {
  Card,
  EmptyState,
  ErrorState,
  LinkButton,
  LoadingPage,
  Notice,
  PageHeader,
  ProgressBar,
  SectionTitle,
} from '../components/ui';

const PATH_ICONS: Record<string, IconName> = {
  phone: 'phone',
  call: 'call',
  chat: 'chat',
  bank: 'bank',
  shield: 'shield',
  globe: 'globe',
};

interface ProgressData {
  rows: ProgressRow[];
  details: PathDetail[];
}

export default function Progress() {
  const { user } = useAuth();
  const { lang, t, tf } = useI18n();
  const online = useOnline();

  const { data, error, loading, reload } = useAsync<ProgressData>(async () => {
    const [pathsResponse] = await Promise.all([
      apiFetch<{ paths: PathSummary[] }>(`/paths?lang=${encodeURIComponent(lang)}`),
      hydrateProgress(user!.id),
    ]);
    const details = await Promise.all(
      pathsResponse.paths.map((path) =>
        apiFetch<{ path: PathDetail }>(
          `/paths/${encodeURIComponent(path.slug)}?lang=${encodeURIComponent(lang)}`,
        ).then((response) => response.path),
      ),
    );
    const progressResponse = await apiFetch<{ progress: ProgressRow[] }>('/progress');
    return { rows: progressResponse.progress, details };
  }, [lang, user?.id]);

  if (!user) return <Navigate to="/auth" replace />;
  if (loading && !data) return <LoadingPage />;
  if (error) return <ErrorState message={errorMessage(error, t)} onRetry={reload} />;
  if (!data) return <LoadingPage />;

  const completedRows = data.rows.filter((row) => row.completedAt);
  const totalLessons = data.details.reduce((sum, path) => sum + path.lessonCount, 0);
  const titleFor = (slug: string): string => {
    for (const path of data.details) {
      const lesson = path.lessons.find((item) => item.slug === slug);
      if (lesson) return lesson.title;
    }
    return slug;
  };
  const recent = completedRows
    .slice()
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, 6);

  return (
    <div className="pb-6">
      <PageHeader title={t('progress.title')} subtitle={t('progress.intro')} backTo="/home" />

      {!online ? (
        <Notice variant="warning" title={t('common.offline')} className="mb-4">
          {t('home.offlineNotice')}
        </Notice>
      ) : null}

      <Card className="mb-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{t('progress.lessonsDone')}</p>
            <p className="text-5xl font-bold leading-none">{completedRows.length}</p>
            <p className="mt-1 text-sm muted">
              {t('common.of')} {totalLessons} {t('common.lessons')}
            </p>
          </div>
          <span className="flex h-20 w-20 items-center justify-center rounded-full border-4">
            <Icon name="chart" size={38} />
          </span>
        </div>
        <div className="mt-4">
          <ProgressBar
            value={percent(completedRows.length, totalLessons)}
            label={tf('progress.completed', { count: completedRows.length })}
          />
        </div>
        <p className="mt-3 font-bold">
          {completedRows.length === 0 ? t('progress.noProgress') : t('progress.keepGoing')}
        </p>
      </Card>

      <SectionTitle>{t('nav.learn')}</SectionTitle>
      <div className="space-y-3">
        {data.details.map((path) => {
          const done = path.lessons.filter((lesson) => lesson.completed).length;
          const complete = done === path.lessonCount && path.lessonCount > 0;
          return (
            <Card key={path.slug} className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2">
                  <Icon name={PATH_ICONS[path.icon] ?? 'book'} size={24} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/paths/${path.slug}`} className="block text-lg font-bold leading-tight">
                    {path.title}
                  </Link>
                  <p className="mt-1 text-sm muted">
                    {done} / {path.lessonCount} {t('common.lessons')}
                  </p>
                  <div className="mt-2">
                    <ProgressBar value={percent(done, path.lessonCount)} label={path.title} showValue={false} />
                  </div>
                </div>
                {complete ? <Icon name="check-circle" size={24} className="mt-1 shrink-0" /> : null}
              </div>
              {complete ? (
                <LinkButton
                  to={`/certificate/${path.slug}`}
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  icon={<Icon name="award" size={18} />}
                >
                  {t('progress.certificate')}
                </LinkButton>
              ) : null}
            </Card>
          );
        })}
      </div>

      <SectionTitle>{t('common.done')}</SectionTitle>
      {recent.length === 0 ? (
        <EmptyState
          icon="book"
          title={t('progress.noProgress')}
          action={
            <LinkButton to="/paths" icon={<Icon name="book" />}>
              {t('home.learn')}
            </LinkButton>
          }
        />
      ) : (
        <ul className="space-y-2">
          {recent.map((row) => (
            <li key={row.lessonSlug} className="flex items-start gap-3 rounded-xl2 border-2 p-3">
              <Icon name="check-circle" size={22} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">
                <Link to={`/lessons/${row.lessonSlug}`} className="block font-bold">
                  {titleFor(row.lessonSlug)}
                </Link>
                <span className="text-sm muted">{formatDate(row.completedAt)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <LinkButton to="/paths" variant="secondary" icon={<Icon name="book" />}>
          {t('home.learn')}
        </LinkButton>
        <LinkButton to="/offline" variant="ghost" icon={<Icon name="download" />}>
          {t('offline.title')}
        </LinkButton>
      </div>
    </div>
  );
}
