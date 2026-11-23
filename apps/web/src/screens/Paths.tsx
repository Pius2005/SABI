import { Link, Navigate } from 'react-router-dom';
import type { PathDetail, PathSummary } from '@sabi/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { apiFetch, ApiError } from '../lib/api';
import { localMap, useOnline } from '../lib/offline';
import { bundleList, getBundle } from '../lib/storage';
import { errorMessage, percent } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Icon, type IconName } from '../components/Icon';
import {
  ErrorState,
  LinkButton,
  LoadingPage,
  Notice,
  PageHeader,
  ProgressBar,
} from '../components/ui';

const PATH_ICONS: Record<string, IconName> = {
  phone: 'phone',
  call: 'call',
  chat: 'chat',
  bank: 'bank',
  shield: 'shield',
  globe: 'globe',
};

interface PathsData {
  paths: PathSummary[];
  details: PathDetail[];
  offline: boolean;
}

export default function Paths() {
  const { user } = useAuth();
  const { lang, t, tf } = useI18n();
  const online = useOnline();

  if (!user) return <Navigate to="/auth" replace />;

  const { data, error, loading, reload } = useAsync<PathsData>(async () => {
    try {
      const response = await apiFetch<{ paths: PathSummary[] }>(`/paths?lang=${encodeURIComponent(lang)}`);
      const details = await Promise.all(
        response.paths.map((path) =>
          apiFetch<{ path: PathDetail }>(`/paths/${encodeURIComponent(path.slug)}?lang=${encodeURIComponent(lang)}`).then(
            (result) => result.path,
          ),
        ),
      );
      return { paths: response.paths, details, offline: false };
    } catch (caught) {
      if (!(caught instanceof ApiError) || caught.code !== 'NETWORK') throw caught;
      const details: PathDetail[] = [];
      const seen = new Set<string>();
      for (const entry of bundleList().filter((item) => item.lang === lang)) {
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
      return { paths, details, offline: true };
    }
  }, [lang]);

  if (loading && !data) return <LoadingPage />;
  if (error) return <ErrorState message={errorMessage(error, t)} onRetry={reload} />;
  if (!data) return <LoadingPage />;

  const map = localMap(user.id);
  const downloads = bundleList().filter((entry) => entry.lang === lang);

  return (
    <div className="pb-6">
      <PageHeader
        title={t('nav.learn')}
        subtitle={t('goals.intro')}
        actions={
          <Link to="/offline" className="btn btn-secondary btn-sm">
            <Icon name="download" size={18} />
            <span>{t('offline.title')}</span>
          </Link>
        }
      />

      {!online ? (
        <Notice variant="warning" title={t('common.offline')} className="mb-4">
          {t('home.offlineNotice')}
        </Notice>
      ) : null}

      <div className="space-y-3">
        {data.paths.map((path) => {
          const detail = data.details.find((item) => item.slug === path.slug);
          const done = detail ? detail.lessons.filter((lesson) => map[lesson.slug]?.completedAt).length : 0;
          const downloaded = downloads.filter((entry) => entry.pathSlug === path.slug).length;
          return (
            <Link
              key={path.slug}
              to={`/paths/${path.slug}`}
              className="flex items-start gap-4 rounded-xl2 border-2 p-4 no-underline"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2">
                <Icon name={PATH_ICONS[path.icon] ?? 'book'} size={30} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-bold leading-tight">{path.title}</span>
                <span className="mt-1 block text-sm muted">
                  {tf('path.lessonCount', { count: path.lessonCount })}
                  {downloaded > 0 ? ` · ${downloaded} ${t('path.downloaded').toLowerCase()}` : ''}
                </span>
                <span className="mt-3 block">
                  <ProgressBar value={percent(done, path.lessonCount)} label={path.title} />
                </span>
              </span>
              <Icon name="forward" size={22} className="mt-2 shrink-0" />
            </Link>
          );
        })}
      </div>

      {data.paths.length === 0 ? (
        <Notice variant="info" title={t('common.offline')} action={<LinkButton to="/offline" variant="secondary">{t('offline.title')}</LinkButton>}>
          <p>{t('home.offlineNotice')}</p>
        </Notice>
      ) : null}

      <p className="mt-6 text-sm muted">{t('path.fallbackNotice')}</p>
    </div>
  );
}
