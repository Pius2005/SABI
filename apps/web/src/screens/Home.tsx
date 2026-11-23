import { Link, Navigate } from 'react-router-dom';
import type { PathDetail, PathSummary, ProgressRow } from '@sabi/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { apiFetch, ApiError } from '../lib/api';
import { localMap, useOnline } from '../lib/offline';
import { bundleList, getBundle, mergeProgressRows } from '../lib/storage';
import { errorMessage, percent } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Icon, type IconName } from '../components/Icon';
import {
  Button,
  Card,
  ErrorState,
  LinkButton,
  LoadingPage,
  Notice,
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

interface HomeData {
  paths: PathSummary[];
  details: PathDetail[];
  goalPath: PathDetail | null;
  nextLesson: PathDetail['lessons'][number] | null;
  completed: number;
  offline: boolean;
}

export default function Home() {
  const { user } = useAuth();
  const { lang, t, tf } = useI18n();
  const online = useOnline();

  if (!user) return <Navigate to="/auth" replace />;

  const { data, error, loading, reload } = useAsync<HomeData>(async () => {
    const local = localMap(user.id);
    try {
      const pathsResponse = await apiFetch<{ paths: PathSummary[] }>(`/paths?lang=${encodeURIComponent(lang)}`);
      const paths = pathsResponse.paths;
      const details = await Promise.all(
        paths.map((path) =>
          apiFetch<{ path: PathDetail }>(`/paths/${encodeURIComponent(path.slug)}?lang=${encodeURIComponent(lang)}`).then(
            (response) => response.path,
          ),
        ),
      );
      const progressResponse = await apiFetch<{ progress: ProgressRow[] }>('/progress');
      const map = mergeProgressRows(user.id, progressResponse.progress);
      const goalPath =
        details.find((path) => path.slug === user.goalPathSlug) ?? details[0] ?? null;
      const nextLesson =
        goalPath?.lessons.find((lesson) => !map[lesson.slug]?.completedAt) ?? goalPath?.lessons[0] ?? null;
      return {
        paths,
        details,
        goalPath,
        nextLesson,
        completed: Object.values(map).filter((row) => row.completedAt).length,
        offline: false,
      };
    } catch (caught) {
      if (!(errorIsNetwork(caught))) throw caught;
      const entries = bundleList().filter((entry) => entry.lang === lang);
      const details: PathDetail[] = [];
      const seen = new Set<string>();
      for (const entry of entries) {
        const bundle = getBundle(lang, entry.slug);
        if (bundle?.path && !seen.has(bundle.path.slug)) {
          seen.add(bundle.path.slug);
          details.push(bundle.path);
        }
      }
      const paths: PathSummary[] = details.map((path) => ({
        slug: path.slug,
        titleKey: path.titleKey,
        goalTag: path.goalTag,
        order: path.order,
        icon: path.icon,
        title: path.title,
        lessonCount: path.lessonCount,
      }));
      const goalPath = details.find((path) => path.slug === user.goalPathSlug) ?? details[0] ?? null;
      const nextLesson =
        goalPath?.lessons.find((lesson) => !local[lesson.slug]?.completedAt) ?? goalPath?.lessons[0] ?? null;
      return {
        paths,
        details,
        goalPath,
        nextLesson,
        completed: Object.values(local).filter((row) => row.completedAt).length,
        offline: true,
      };
    }
  }, [user.id, user.goalPathSlug, lang]);

  if (loading && !data) return <LoadingPage />;
  if (error) {
    return <ErrorState message={errorMessage(error, t)} onRetry={reload} />;
  }
  if (!data) return <LoadingPage />;

  const { details, goalPath, nextLesson, completed } = data;
  const totalLessons = details.reduce((sum, path) => sum + path.lessonCount, 0) || 40;
  const map = localMap(user.id);

  return (
    <div className="pb-6">
      <header className="mb-5">
        <p className="eyebrow">{goalPath ? goalPath.title : t('common.welcome')}</p>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          {tf('home.greeting', { name: user.displayName })}
        </h1>
        <p className="mt-2 text-lg muted">{t('home.subtitle')}</p>
      </header>

      {!online ? (
        <Notice variant="warning" title={t('common.offline')} className="mb-4">
          {t('home.offlineNotice')}
        </Notice>
      ) : null}

      {nextLesson ? (
        <Link
          to={`/lessons/${nextLesson.slug}`}
          className="mb-4 block rounded-xl2 border-4 bg-ink p-5 text-paper no-underline"
        >
          <p className="text-sm font-bold uppercase tracking-widest">{t('home.continue')}</p>
          <p className="mt-2 text-2xl font-bold leading-tight">{nextLesson.title}</p>
          <p className="mt-1 text-sm">
            {goalPath?.title} · {tf('common.minutes', { count: nextLesson.minutes })}
          </p>
          <span className="mt-4 inline-flex min-h-[3.5rem] items-center gap-2 rounded-xl2 border-2 border-paper px-5 py-2 font-bold">
            <Icon name="play" size={20} />
            {t('home.continue')}
          </span>
        </Link>
      ) : (
        <Card className="mb-4">
          <p className="text-xl font-bold">{t('progress.noProgress')}</p>
          <LinkButton to="/paths" className="mt-3" icon={<Icon name="book" />}>
            {t('home.learn')}
          </LinkButton>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/voice" className="card flex min-h-[7rem] flex-col justify-between no-underline">
          <Icon name="mic" size={32} />
          <span className="mt-2 text-lg font-bold">{t('home.ask')}</span>
        </Link>
        <Link to="/scam" className="card flex min-h-[7rem] flex-col justify-between no-underline">
          <Icon name="shield" size={32} />
          <span className="mt-2 text-lg font-bold">{t('home.safe')}</span>
        </Link>
        <Link to="/progress" className="card flex min-h-[7rem] flex-col justify-between no-underline">
          <Icon name="chart" size={32} />
          <span className="mt-2 text-lg font-bold">{t('home.progress')}</span>
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton to="/help" variant="secondary" icon={<Icon name="help" />}>
          {t('home.stuck')}
        </LinkButton>
        <LinkButton to="/offline" variant="secondary" icon={<Icon name="download" />}>
          {t('offline.title')}
        </LinkButton>
      </div>

      <SectionTitle action={<Link to="/paths" className="link text-base">{t('home.learn')}</Link>}>
        {t('home.learn')}
      </SectionTitle>

      <div className="mb-3 rounded-xl2 border-2 p-4">
        <ProgressBar
          value={percent(completed, totalLessons)}
          label={tf('progress.completed', { count: completed })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.paths.map((path) => {
          const detail = details.find((item) => item.slug === path.slug);
          const done = detail ? detail.lessons.filter((lesson) => map[lesson.slug]?.completedAt).length : 0;
          return (
            <Link
              key={path.slug}
              to={`/paths/${path.slug}`}
              className="flex items-start gap-3 rounded-xl2 border-2 p-4 no-underline"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2">
                <Icon name={PATH_ICONS[path.icon] ?? 'book'} size={26} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold leading-tight">{path.title}</span>
                <span className="mt-1 block text-sm muted">
                  {tf('path.lessonCount', { count: path.lessonCount })}
                </span>
                <span className="mt-2 block">
                  <ProgressBar
                    value={percent(done, path.lessonCount)}
                    label={path.title}
                    showValue={false}
                  />
                </span>
              </span>
              <Icon name="forward" size={20} className="mt-1 shrink-0" />
            </Link>
          );
        })}
      </div>

      {data.paths.length === 0 ? (
        <Card className="mt-4">
          <p className="font-bold">{t('common.offline')}</p>
          <p className="mt-1">{t('home.offlineNotice')}</p>
          <LinkButton to="/offline" variant="secondary" className="mt-3" icon={<Icon name="download" />}>
            {t('offline.title')}
          </LinkButton>
        </Card>
      ) : null}
    </div>
  );
}

function errorIsNetwork(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'NETWORK' || error.status === 0);
}
