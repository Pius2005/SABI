import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { AdminAnalytics, Lang, TranslationStatus } from '@sabi/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { errorMessage, formatDate, percent } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Icon } from '../components/Icon';
import {
  Button,
  Card,
  Dialog,
  ErrorState,
  LoadingPage,
  Notice,
  PageHeader,
  ProgressBar,
  Spinner,
  StatusPill,
} from '../components/ui';

type Tab = 'overview' | 'translations' | 'scams' | 'audit' | 'users' | 'voice' | 'glossary';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'translations', label: 'Translations' },
  { id: 'scams', label: 'Scam examples' },
  { id: 'audit', label: 'Audit log' },
  { id: 'users', label: 'People' },
  { id: 'voice', label: 'Voice' },
  { id: 'glossary', label: 'Glossary' },
];

export default function Admin() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('overview');

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="pb-6">
      <PageHeader title={t('admin.title')} subtitle={t('admin.analytics')} backTo="/home" />

      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label={t('admin.title')}>
        {TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            onClick={() => setTab(entry.id)}
            className={`chip ${tab === entry.id ? 'chip-solid' : ''}`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'overview' ? <Overview /> : null}
      {tab === 'translations' ? <Translations /> : null}
      {tab === 'scams' ? <Scams /> : null}
      {tab === 'audit' ? <Audit /> : null}
      {tab === 'users' ? <Users /> : null}
      {tab === 'voice' ? <VoiceEval /> : null}
      {tab === 'glossary' ? <Glossary /> : null}
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-end justify-between gap-2">
        <h2 className="text-2xl font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Overview() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useAsync<AdminAnalytics>(async () => {
    const response = await apiFetch<{ analytics: AdminAnalytics }>('/admin/analytics');
    return response.analytics;
  }, []);

  if (loading && !data) return <LoadingPage />;
  if (error) return <ErrorState message={errorMessage(error, t)} onRetry={reload} />;
  if (!data) return null;

  const cards: Array<{
    label: string;
    value: number;
    icon: 'users' | 'check-circle' | 'book' | 'help' | 'mic' | 'shield' | 'alert';
  }> = [
    { label: 'Learners', value: data.learners, icon: 'users' },
    { label: 'Active this week', value: data.activeLearners, icon: 'check-circle' },
    { label: 'Lessons completed', value: data.lessonsCompleted, icon: 'book' },
    { label: 'Stuck events', value: data.stuckEvents, icon: 'alert' },
    { label: 'Help open', value: data.helpOpen, icon: 'help' },
    { label: 'Voice turns', value: data.voiceTurns, icon: 'mic' },
    { label: 'Scam checks', value: data.scamChecks, icon: 'shield' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label} className="p-4">
            <Icon name={card.icon} size={24} />
            <p className="mt-2 text-3xl font-bold leading-none">{card.value}</p>
            <p className="mt-1 text-sm muted">{card.label}</p>
          </Card>
        ))}
      </div>

      <Section title={t('admin.coverage')}>
        <div className="space-y-3">
          {(Object.keys(data.translationCoverage) as Lang[]).map((lang) => {
            const row = data.translationCoverage[lang];
            const approved = percent(row.approved, row.total);
            return (
              <Card key={lang} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">{lang.toUpperCase()}</p>
                  <p className="text-sm muted">
                    {row.approved} / {row.total}
                  </p>
                </div>
                <div className="mt-2">
                  <ProgressBar value={approved} label={t('admin.approve')} showValue={false} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  <span className="chip">{t('admin.needsReview')}: {row.needsReview}</span>
                  <span className="chip">{t('admin.draft')}: {row.missing}</span>
                </div>
              </Card>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

interface TranslationRow {
  key: string;
  lang: Lang;
  text: string;
  status: TranslationStatus;
  reviewerId: string | null;
  reviewedAt: string | null;
  audioUrl: string | null;
}

function Translations() {
  const { t } = useI18n();
  const [lang, setLang] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<TranslationRow | null>(null);
  const [editText, setEditText] = useState('');
  const [editStatus, setEditStatus] = useState<TranslationStatus>('needs_review');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, error: loadError, loading, reload } = useAsync<{
    items: TranslationRow[];
    total: number;
    page: number;
    limit: number;
  }>(async () => {
    const params = new URLSearchParams({ page: String(page), limit: '40' });
    if (lang) params.set('lang', lang);
    if (status) params.set('status', status);
    if (query.trim()) params.set('q', query.trim());
    return apiFetch(`/admin/translations?${params.toString()}`);
  }, [lang, status, query, page]);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/admin/translations', {
        method: 'PATCH',
        body: { key: editing.key, lang: editing.lang, text: editText, status: editStatus },
      });
      setEditing(null);
      setMessage(t('common.saved'));
      reload();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const approve = async (row: TranslationRow) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/admin/translations', {
        method: 'PATCH',
        body: { key: row.key, lang: row.lang, status: 'approved' },
      });
      setMessage(t('admin.approve'));
      reload();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const generateAudio = async (row: TranslationRow) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/admin/audio/generate', { method: 'POST', body: { key: row.key, lang: row.lang } });
      setMessage('Audio ready');
      reload();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      {message ? (
        <Notice variant="success" className="mb-3">
          {message}
        </Notice>
      ) : null}
      {error ? (
        <Notice variant="error" className="mb-3">
          {error}
        </Notice>
      ) : null}

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        <select className="select" aria-label="Language" value={lang} onChange={(event) => { setLang(event.target.value); setPage(1); }}>
          <option value="">All languages</option>
          <option value="en">English</option>
          <option value="yo">Yorùbá</option>
          <option value="ig">Igbo</option>
          <option value="pcm">Pidgin</option>
        </select>
        <select className="select" aria-label="Status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="approved">Approved</option>
          <option value="needs_review">Needs review</option>
          <option value="machine">Machine</option>
          <option value="draft">Draft</option>
        </select>
        <input
          className="input"
          placeholder="Search key or text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
        />
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4">
          <Spinner size={20} />
          <span>{t('common.loading')}</span>
        </div>
      ) : null}
      {loadError ? <ErrorState message={errorMessage(loadError, t)} onRetry={reload} /> : null}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Key</th>
              <th scope="col">Text</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={`${row.key}|${row.lang}`}>
                <td>
                  <span className="font-bold">{row.key}</span>
                  <span className="block text-xs muted">{row.lang.toUpperCase()}</span>
                </td>
                <td className="max-w-[20rem]">{row.text}</td>
                <td>
                  <StatusPill status={row.status} />
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(row);
                        setEditText(row.text);
                        setEditStatus(row.status);
                      }}
                    >
                      Edit
                    </Button>
                    {row.status !== 'approved' ? (
                      <Button variant="secondary" size="sm" disabled={busy} onClick={() => void approve(row)}>
                        {t('admin.approve')}
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => void generateAudio(row)}>
                        Make audio
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && data.items.length === 0 ? <p className="mt-3 muted">No translations match.</p> : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
          {t('action.back')}
        </Button>
        <span className="text-sm muted">
          {page} / {pages}
        </span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>
          {t('action.next')}
        </Button>
      </div>

      <Dialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `${editing.key} (${editing.lang})` : 'Edit'}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              {t('action.cancel')}
            </Button>
            <Button loading={busy} onClick={() => void save()} icon={<Icon name="check" />}>
              {t('action.save')}
            </Button>
          </>
        }
      >
        <label className="label" htmlFor="translation-text">
          Text
        </label>
        <textarea
          id="translation-text"
          className="textarea"
          value={editText}
          maxLength={2000}
          onChange={(event) => setEditText(event.target.value)}
        />
        <label className="label mt-3" htmlFor="translation-status">
          Status
        </label>
        <select
          id="translation-status"
          className="select"
          value={editStatus}
          onChange={(event) => setEditStatus(event.target.value as TranslationStatus)}
        >
          <option value="draft">Draft</option>
          <option value="machine">Machine</option>
          <option value="needs_review">Needs review</option>
          <option value="approved">Approved</option>
        </select>
        <p className="hint mt-2">
          Only approve text a native speaker has checked. Approved audio is generated after the text is
          approved.
        </p>
      </Dialog>
    </div>
  );
}

interface ScamRow {
  id: string;
  type: string;
  lang: Lang;
  text: string;
  isScam: boolean;
  redFlags: string[];
}

function Scams() {
  const { t } = useI18n();
  const [type, setType] = useState('');
  const [lang, setLang] = useState<Lang>('en');
  const [text, setText] = useState('');
  const [isScam, setIsScam] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data, error: loadError, loading, reload } = useAsync<ScamRow[]>(async () => {
    const response = await apiFetch<{ examples: ScamRow[] }>('/admin/scam-examples');
    return response.examples;
  }, []);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/admin/scam-examples', {
        method: 'POST',
        body: { type: type.trim(), lang, text: text.trim(), isScam, redFlags: [] },
      });
      setMessage(t('admin.saveScam'));
      setType('');
      setText('');
      reload();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/scam-examples/${encodeURIComponent(id)}`, { method: 'DELETE' });
      reload();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {message ? <Notice variant="success" className="mb-3">{message}</Notice> : null}
      {error ? <Notice variant="error" className="mb-3">{error}</Notice> : null}
      {loadError ? <ErrorState message={errorMessage(loadError, t)} onRetry={reload} /> : null}
      {loading && !data ? <LoadingPage /> : null}

      <Section title={t('admin.addScam')}>
        <Card>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="scam-type">
                {t('admin.scamType')}
              </label>
              <input id="scam-type" className="input" value={type} onChange={(event) => setType(event.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="scam-lang">
                {t('common.language')}
              </label>
              <select
                id="scam-lang"
                className="select"
                value={lang}
                onChange={(event) => setLang(event.target.value as Lang)}
              >
                <option value="en">English</option>
                <option value="yo">Yorùbá</option>
                <option value="ig">Igbo</option>
                <option value="pcm">Pidgin</option>
              </select>
            </div>
          </div>
          <label className="label mt-2" htmlFor="scam-text-admin">
            {t('admin.scamText')}
          </label>
          <textarea
            id="scam-text-admin"
            className="textarea"
            value={text}
            maxLength={2000}
            onChange={(event) => setText(event.target.value)}
          />
          <label className="mt-2 flex items-center gap-2 font-bold">
            <input
              type="checkbox"
              className="h-6 w-6 accent-ink"
              checked={isScam}
              onChange={(event) => setIsScam(event.target.checked)}
            />
            {t('admin.isScam')}
          </label>
          <Button
            className="mt-3"
            loading={busy}
            disabled={type.trim().length < 2 || text.trim().length < 5}
            onClick={() => void add()}
            icon={<Icon name="plus" />}
          >
            {t('admin.saveScam')}
          </Button>
        </Card>
      </Section>

      <Section title={t('admin.scams')}>
        <div className="space-y-2">
          {data?.map((row) => (
            <div key={row.id} className="rounded-xl2 border-2 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    <span className="chip">{row.type}</span>
                    <span className="chip">{row.lang.toUpperCase()}</span>
                    <span className="chip">{row.isScam ? t('admin.isScam') : 'Safe'}</span>
                  </p>
                  <p className="mt-2">{row.text}</p>
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={busy}
                  onClick={() => void remove(row.id)}
                  icon={<Icon name="trash" size={16} />}
                >
                  {t('admin.deleteScam')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

interface AuditRow {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

function Audit() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useAsync<AuditRow[]>(async () => {
    const response = await apiFetch<{ logs: AuditRow[] }>('/admin/audit-logs');
    return response.logs;
  }, []);

  if (loading && !data) return <LoadingPage />;
  if (error) return <ErrorState message={errorMessage(error, t)} onRetry={reload} />;
  if (!data || data.length === 0) {
    return (
      <Card>
        <p className="font-bold">{t('admin.auditEmpty')}</p>
      </Card>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Action</th>
            <th scope="col">Entity</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              <td>{formatDate(row.createdAt)}</td>
              <td className="font-bold">{row.action}</td>
              <td>
                {row.entity}
                {row.entityId ? <span className="block text-xs muted">{row.entityId}</span> : null}
              </td>
              <td className="text-xs">{row.meta ? JSON.stringify(row.meta) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface AdminUserRow {
  id: string;
  role: string;
  name: string;
  lang: string;
  phone: string | null;
  email: string | null;
  createdAt: string;
}

function Users() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useAsync<AdminUserRow[]>(async () => {
    const response = await apiFetch<{ users: AdminUserRow[] }>('/admin/users');
    return response.users;
  }, []);

  if (loading && !data) return <LoadingPage />;
  if (error) return <ErrorState message={errorMessage(error, t)} onRetry={reload} />;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Role</th>
            <th scope="col">Contact</th>
            <th scope="col">Joined</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((row) => (
            <tr key={row.id}>
              <td className="font-bold">
                {row.name}
                <span className="block text-xs muted">{row.lang.toUpperCase()}</span>
              </td>
              <td>{row.role}</td>
              <td>
                {row.phone ?? '—'}
                {row.email ? <span className="block text-xs muted">{row.email}</span> : null}
              </td>
              <td>{formatDate(row.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VoiceEval() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useAsync<{
    evaluations: Array<{ id: string; kind: string; provider: string; lang: string; metric: string; value: number; createdAt: string }>;
    note: string;
  }>(async () => apiFetch('/admin/voice-eval'), []);

  if (loading && !data) return <LoadingPage />;
  if (error) return <ErrorState message={errorMessage(error, t)} onRetry={reload} />;
  if (!data) return null;

  return (
    <div>
      <Notice variant="info" className="mb-3">
        {data.note}
      </Notice>
      {data.evaluations.length === 0 ? (
        <Card>
          <p className="font-bold">{t('admin.voiceEval')}</p>
          <p className="mt-1 text-sm muted">No evaluation rows yet.</p>
        </Card>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Kind</th>
                <th scope="col">Provider</th>
                <th scope="col">Language</th>
                <th scope="col">Metric</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.evaluations.map((row) => (
                <tr key={row.id}>
                  <td>{row.kind}</td>
                  <td>{row.provider}</td>
                  <td>{row.lang}</td>
                  <td>{row.metric}</td>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Glossary() {
  const { t } = useI18n();
  const { data, error, loading, reload } = useAsync<Array<{ id: string; term: string; explanation: string; pcm?: string; status: string }>>(
    async () => {
      const response = await apiFetch<{ glossary: Array<{ id: string; term: string; explanation: string; pcm?: string; status: string }> }>(
        '/admin/glossary',
      );
      return response.glossary;
    },
    [],
  );

  if (loading && !data) return <LoadingPage />;
  if (error) return <ErrorState message={errorMessage(error, t)} onRetry={reload} />;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Term</th>
            <th scope="col">Explanation</th>
            <th scope="col">Pidgin</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((row) => (
            <tr key={row.id}>
              <td className="font-bold">{row.term}</td>
              <td>{row.explanation}</td>
              <td>{row.pcm ?? '—'}</td>
              <td>
                <StatusPill status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
