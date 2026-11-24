import { Link, Navigate, useParams } from 'react-router-dom';
import type { PathDetail } from '@sabi/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { APP_NAME } from '../lib/config';
import { errorMessage, formatDate, percent } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Icon } from '../components/Icon';
import { Button, Card, ErrorState, LinkButton, LoadingPage, Notice, ProgressBar } from '../components/ui';

export default function Certificate() {
  const { pathSlug = '' } = useParams();
  const { user } = useAuth();
  const { lang, t, tf } = useI18n();

  const { data, error, loading, reload } = useAsync<PathDetail>(async () => {
    const response = await apiFetch<{ path: PathDetail }>(
      `/paths/${encodeURIComponent(pathSlug)}?lang=${encodeURIComponent(lang)}`,
    );
    return response.path;
  }, [pathSlug, lang]);

  if (!user) return <Navigate to="/auth" replace />;
  if (loading && !data) return <LoadingPage />;
  if (error) return <ErrorState message={errorMessage(error, t)} onRetry={reload} />;
  if (!data) return <LoadingPage />;

  const done = data.lessons.filter((lesson) => lesson.completed).length;
  const complete = done === data.lessonCount && data.lessonCount > 0;
  const today = formatDate(new Date().toISOString());

  return (
    <div className="pb-6">
      <div className="no-print mb-4 flex items-center justify-between gap-2">
        <Link to="/progress" className="btn btn-ghost btn-sm -ml-2">
          <Icon name="back" size={20} />
          <span>{t('action.back')}</span>
        </Link>
        {complete ? (
          <Button onClick={() => window.print()} icon={<Icon name="printer" />}>
            {t('certificate.print')}
          </Button>
        ) : (
          <span />
        )}
      </div>

      {!complete ? (
        <Notice variant="warning" title={t('certificate.title')} className="no-print mb-4">
          <p>Finish every lesson in this path to unlock the certificate.</p>
          <div className="mt-3">
            <ProgressBar value={percent(done, data.lessonCount)} label={data.title} />
          </div>
          <LinkButton to={`/paths/${data.slug}`} variant="secondary" className="mt-3">
            {t('lesson.backToPath')}
          </LinkButton>
        </Notice>
      ) : null}

      {complete ? (
        <Card className="print-page relative overflow-hidden text-center">
          <div className="pattern absolute inset-x-0 top-0 h-3" aria-hidden="true" />
          <p className="eyebrow mt-4">{APP_NAME}</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">{t('certificate.title')}</h1>

          <div className="mx-auto my-6 flex h-24 w-24 items-center justify-center rounded-full border-4">
            <Icon name="award" size={52} />
          </div>

          <p className="text-lg">{t('certificate.awarded')}</p>
          <p className="mt-2 text-3xl font-bold">{user.displayName}</p>

          <p className="mx-auto mt-4 max-w-md text-lg">
            {tf('certificate.body', { path: data.title })}
          </p>

          <div className="mx-auto mt-8 grid max-w-md gap-3 text-left sm:grid-cols-2">
            <div className="rounded-xl border-2 p-3">
              <p className="eyebrow">{t('certificate.date')}</p>
              <p className="mt-1 font-bold">{today}</p>
            </div>
            <div className="rounded-xl border-2 p-3">
              <p className="eyebrow">{t('common.lessons')}</p>
              <p className="mt-1 font-bold">
                {done} / {data.lessonCount}
              </p>
            </div>
          </div>

          <p className="mt-8 text-sm muted">
            {APP_NAME} · {t('certificate.title')}
          </p>
          <div className="pattern absolute inset-x-0 bottom-0 h-3" aria-hidden="true" />
        </Card>
      ) : null}
    </div>
  );
}
