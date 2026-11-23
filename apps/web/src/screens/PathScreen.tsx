import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type { PathDetail } from '@sabi/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { apiFetch, ApiError } from '../lib/api';
import { downloadPath, localMap, useOnline } from '../lib/offline';
import { errorMessage, percent } from '../lib/format';
import { bundleList, getBundle } from '../lib/storage';
import { useAsync } from '../lib/useAsync';
import { Icon, type IconName } from '../components/Icon';
import {
  Button,
  Card,
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

interface PathData {
  path: PathDetail;
  offline: boolean;
}

export default function PathScreen() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const { lang, t, tf } = useI18n();
  const online = useOnline();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const { data, error, loading, reload } = useAsync<PathData>(async () => {
    try {
      const response = await apiFetch<{ path: PathDetail }>(
        `/paths/${encodeURIComponent(slug)}?lang=${encodeURIComponent(lang)}`,
      );
      return { path: response.path, offline: false };
    } catch (caught) {
      if (!(caught instanceof ApiError) || caught.code !== 'NETWORK') throw caught;
      const fallback = findOfflinePath(lang, slug);
      if (!fallback) throw caught;
      return { path: fallback, offline: true };
    }
  }, [slug, lang]);

  const map = useMemo(() => (user ? localMap(user.id) : {}), [user, data]);

  if (!user) return <Navigate to="/auth" replace />;
  if (loading && !data) return <LoadingPage />;
  if (error) return <ErrorState message={errorMessage(error, t)} onRetry={reload} />;
  if (!data) return <LoadingPage />;

  const { path } = data;
  const completed = path.lessons.filter((lesson) => map[lesson.slug]?.completedAt || lesson.completed).length;
  const nextLesson = path.lessons.find((lesson) => !(map[lesson.slug]?.completedAt || lesson.completed)) ?? path.lessons[0];

  const download = async () => {
    setDownloading(true);
    setDownloadError(null);
    setProgress({ done: 0, total: path.lessons.length });
    try {
      await downloadPath(lang, slug, (done, total) => setProgress({ done, total }));
      setDownloaded(true);
    } catch (caught) {
      setDownloadError(errorMessage(caught, t));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="pb-6">
      <PageHeader
        title={path.title}
        subtitle={tf('path.lessonCount', { count: path.lessonCount })}
        backTo="/paths"
        actions={
          <span className="chip">
            <Icon name={PATH_ICONS[path.icon] ?? 'book'} size={16} />
            {percent(completed, path.lessonCount)}%
          </span>
        }
      />

      {data.offline ? (
        <Notice variant="warning" title={t('common.offline')} className="mb-4">
          {t('home.offlineNotice')}
        </Notice>
      ) : null}

      <Card className="mb-5">
        <ProgressBar
          value={percent(completed, path.lessonCount)}
          label={tf('progress.completed', { count: completed })}
        />
        {nextLesson ? (
          <LinkButton
            to={`/lessons/${nextLesson.slug}`}
            size="lg"
            block
            className="mt-4"
            icon={<Icon name="play" />}
          >
            {completed === 0 ? t('action.start') : t('home.continue')}
          </LinkButton>
        ) : null}
        {online ? (
          <div className="mt-3">
            <Button
              variant="secondary"
              block
              loading={downloading}
              onClick={() => void download()}
              icon={<Icon name="download" />}
            >
              {downloading ? t('path.downloading') : t('path.download')}
            </Button>
            {progress && downloading ? (
              <div className="mt-2">
                <ProgressBar
                  value={percent(progress.done, progress.total)}
                  label={`${progress.done} / ${progress.total}`}
                />
              </div>
            ) : null}
            {downloaded ? (
              <p className="mt-2 flex items-center gap-2 text-sm font-bold" role="status">
                <Icon name="check-circle" size={18} />
                {t('path.downloaded')}
              </p>
            ) : null}
            {downloadError ? (
              <p className="mt-2 text-sm font-bold" role="alert">
                {downloadError}
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <h2 className="mb-3 text-2xl font-bold">{t('common.lessons')}</h2>
      <ol className="space-y-3">
        {path.lessons.map((lesson, index) => {
          const localRow = map[lesson.slug];
          const isDone = Boolean(localRow?.completedAt) || lesson.completed;
          const started = Boolean(localRow) && !isDone;
          const cached = Boolean(getBundle(lang, lesson.slug));
          return (
            <li key={lesson.slug}>
              <Link
                to={`/lessons/${lesson.slug}`}
                className="flex items-start gap-4 rounded-xl2 border-2 p-4 no-underline"
              >
                <span
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold ${
                    isDone ? 'bg-ink text-paper' : ''
                  }`}
                  aria-hidden="true"
                >
                  {isDone ? <Icon name="check" size={24} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold leading-tight">{lesson.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm muted">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="clock" size={14} />
                      {tf('common.minutes', { count: lesson.minutes })}
                    </span>
                    {isDone ? <span className="font-bold text-ink">{t('common.completed')}</span> : null}
                    {started ? (
                      <span className="font-bold text-ink">
                        {tf('common.stepOf', {
                          current: (localRow?.stepIndex ?? 0) + 1,
                          total: '…',
                        })}
                      </span>
                    ) : null}
                    {cached ? (
                      <span className="inline-flex items-center gap-1">
                        <Icon name="download" size={14} />
                        {t('path.downloaded')}
                      </span>
                    ) : null}
                  </span>
                </span>
                <Icon name="forward" size={20} className="mt-2 shrink-0" />
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="mt-6 text-sm muted">{t('path.fallbackNotice')}</p>
    </div>
  );
}

function findOfflinePath(lang: string, slug: string): PathDetail | null {
  for (const entry of bundleList()) {
    if (entry.lang !== lang) continue;
    const bundle = getBundle(entry.lang, entry.slug);
    if (bundle?.path && bundle.path.slug === slug) return bundle.path;
  }
  return null;
}
