import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useOnline, syncOutbox } from '../lib/offline';
import { useInstallPrompt } from '../lib/pwa';
import {
  bundleList,
  clearBundles,
  loadOutbox,
  removeBundle,
  type BundleEntry,
} from '../lib/storage';
import { errorMessage, formatDate } from '../lib/format';
import { Icon } from '../components/Icon';
import { Button, Card, EmptyState, LinkButton, Notice, PageHeader } from '../components/ui';

export default function Offline() {
  const { user } = useAuth();
  const { lang, t, tf } = useI18n();
  const online = useOnline();
  const { available, installed, install } = useInstallPrompt();

  const [bundles, setBundles] = useState<BundleEntry[]>([]);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);

  const refresh = () => {
    setBundles(bundleList());
    setPending(user ? loadOutbox(user.id).length : 0);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return;
    navigator.storage
      .estimate()
      .then((estimate) => setUsage({ used: estimate.usage ?? 0, quota: estimate.quota ?? 0 }))
      .catch(() => undefined);
  }, [bundles.length]);

  if (!user) return <Navigate to="/auth" replace />;

  const sync = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const applied = await syncOutbox(user.id);
      setMessage(`${t('offline.synced')} (${applied})`);
      refresh();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const remove = (entry: BundleEntry) => {
    removeBundle(entry.lang, entry.slug);
    refresh();
  };

  const clearAll = () => {
    clearBundles();
    refresh();
  };

  return (
    <div className="pb-6">
      <PageHeader
        title={t('offline.title')}
        subtitle={tf('offline.message', { count: bundles.length })}
        backTo="/home"
      />

      {!online ? (
        <Notice variant="warning" title={t('common.offline')} className="mb-4">
          {t('home.offlineNotice')}
        </Notice>
      ) : null}
      {error ? (
        <Notice variant="error" title={t('common.error')} className="mb-4">
          {error}
        </Notice>
      ) : null}
      {message ? (
        <Notice variant="success" className="mb-4">
          {message}
        </Notice>
      ) : null}

      <Card className="mb-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">{tf('offline.pending', { count: pending })}</p>
            <p className="text-4xl font-bold leading-none">{pending}</p>
            <p className="mt-1 text-sm muted">
              {pending === 0 ? 'Everything is saved.' : 'Progress waiting to sync.'}
            </p>
          </div>
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2">
            <Icon name={online ? 'wifi' : 'wifi-off'} size={30} />
          </span>
        </div>
        <Button
          className="mt-4"
          block
          variant="secondary"
          disabled={!online || pending === 0}
          loading={busy}
          onClick={() => void sync()}
          icon={<Icon name="refresh" />}
        >
          {t('offline.sync')}
        </Button>
      </Card>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <LinkButton to="/paths" icon={<Icon name="download" />}>
          {t('path.download')}
        </LinkButton>
        {bundles.length > 0 ? (
          <Button variant="danger" size="sm" onClick={clearAll} icon={<Icon name="trash" size={16} />}>
            {t('action.delete')}
          </Button>
        ) : null}
      </div>

      <h2 className="mb-3 text-2xl font-bold">{t('offline.downloaded')}</h2>
      {bundles.length === 0 ? (
        <EmptyState
          icon="download"
          title={t('offline.downloaded')}
          action={
            <LinkButton to="/paths" variant="secondary" icon={<Icon name="book" />}>
              {t('home.learn')}
            </LinkButton>
          }
        >
          Open a learning path and press “{t('path.download')}”. The lessons will work without internet.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {bundles.map((entry) => (
            <li key={`${entry.lang}:${entry.slug}`} className="flex items-start gap-3 rounded-xl2 border-2 p-3">
              <Icon name="book" size={24} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <Link to={`/lessons/${entry.slug}`} className="block font-bold">
                  {entry.title}
                </Link>
                <p className="text-sm muted">
                  {entry.lang.toUpperCase()} · {formatDate(entry.downloadedAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(entry)}
                aria-label={`${t('action.delete')} ${entry.title}`}
                icon={<Icon name="trash" size={18} />}
              />
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-3 mt-7 text-2xl font-bold">{t('offline.install')}</h2>
      <Card>
        <p>{t('offline.installHint')}</p>
        {installed ? (
          <p className="mt-2 flex items-center gap-2 font-bold">
            <Icon name="check-circle" size={20} />
            {t('common.saved')}
          </p>
        ) : available ? (
          <Button className="mt-3" onClick={() => void install()} icon={<Icon name="install" />}>
            {t('action.install')}
          </Button>
        ) : null}
        {usage && usage.quota > 0 ? (
          <p className="mt-3 text-sm muted">
            Storage used on this phone: {Math.round((usage.used / 1024 / 1024) * 10) / 10} MB of{' '}
            {Math.round(usage.quota / 1024 / 1024)} MB
          </p>
        ) : null}
      </Card>

      <p className="mt-6 text-sm muted">
        Lessons are saved on this phone only. Clearing the browser data will remove them. Your progress
        is saved again when you are back online.
      </p>
    </div>
  );
}
