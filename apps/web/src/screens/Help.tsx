import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { errorMessage, formatDate } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Icon } from '../components/Icon';
import {
  Button,
  Card,
  ErrorState,
  LoadingPage,
  Notice,
  PageHeader,
  SectionTitle,
} from '../components/ui';

type HelpType = 'call_back' | 'whatsapp' | 'facilitator';

interface HelpRow {
  id: string;
  userId: string;
  learnerName?: string;
  type: HelpType;
  context: Record<string, unknown> | null;
  status: 'open' | 'contacted' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
}

const OPTIONS: Array<{ type: HelpType; labelKey: string; icon: 'phone' | 'chat' | 'users'; description: string }> = [
  { type: 'call_back', labelKey: 'help.callback', icon: 'phone', description: 'A person calls your phone.' },
  { type: 'whatsapp', labelKey: 'help.whatsapp', icon: 'chat', description: 'A person sends a WhatsApp message.' },
  { type: 'facilitator', labelKey: 'help.facilitator', icon: 'users', description: 'Your class facilitator helps you.' },
];

export default function Help() {
  const { user } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const context = (location.state as { context?: Record<string, unknown> } | null)?.context ?? null;

  const [type, setType] = useState<HelpType>('call_back');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const staff = user?.role === 'FACILITATOR' || user?.role === 'ADMIN';

  const { data, error: loadError, loading, reload } = useAsync<HelpRow[]>(async () => {
    if (!staff) return [];
    const response = await apiFetch<{ requests: HelpRow[] }>('/help-requests');
    return response.requests;
  }, [staff]);

  if (!user) return <Navigate to="/auth" replace />;
  if (staff && loading && !data) return <LoadingPage />;
  if (staff && loadError) return <ErrorState message={errorMessage(loadError, t)} onRetry={reload} />;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/help-requests', {
        method: 'POST',
        body: { type, context: { ...(context ?? {}), note: note.trim() || undefined } },
      });
      setSent(true);
      setNote('');
      if (staff) reload();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const update = async (id: string, status: HelpRow['status']) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/help-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } });
      setMessage(t(`help.status.${status}`));
      reload();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const open = (data ?? []).filter((row) => row.status !== 'resolved');

  return (
    <div className="pb-6">
      <PageHeader title={t('help.title')} subtitle={t('help.intro')} backTo="/home" />

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

      <Notice variant="warning" className="mb-4" title="Keep your secrets safe">
        A real helper will never ask for your PIN, OTP, password, BVN, NIN or card details. If someone
        asks, stop and tell a person you trust.
      </Notice>

      {sent ? (
        <Card className="mb-4">
          <div className="flex items-start gap-3">
            <Icon name="check-circle" size={30} className="shrink-0" />
            <div>
              <p className="text-xl font-bold">{t('help.sent')}</p>
              <p className="mt-1">{t('help.queue')}</p>
            </div>
          </div>
          <Button variant="secondary" className="mt-4" onClick={() => setSent(false)} icon={<Icon name="plus" />}>
            {t('help.send')}
          </Button>
        </Card>
      ) : (
        <Card className="mb-5">
          <fieldset>
            <legend className="mb-2 font-bold">{t('help.send')}</legend>
            <div className="space-y-2">
              {OPTIONS.map((option) => {
                const active = type === option.type;
                return (
                  <label
                    key={option.type}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl2 border-2 p-4 ${
                      active ? 'bg-ink text-paper' : 'bg-paper text-ink'
                    }`}
                  >
                    <input
                      type="radio"
                      name="help-type"
                      className="mt-1 h-5 w-5 shrink-0"
                      checked={active}
                      onChange={() => setType(option.type)}
                    />
                    <span className="flex-1">
                      <span className="flex items-center gap-2 font-bold">
                        <Icon name={option.icon} size={20} />
                        {t(option.labelKey)}
                      </span>
                      <span className={`mt-1 block text-sm ${active ? '' : 'muted'}`}>{option.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="label mt-4" htmlFor="help-note">
            What do you need help with? <span className="font-normal muted">({t('common.optional')})</span>
          </label>
          <textarea
            id="help-note"
            className="textarea"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Example: I cannot open WhatsApp."
          />

          <Button
            className="mt-3"
            size="lg"
            block
            loading={busy}
            onClick={() => void send()}
            icon={<Icon name="send" />}
          >
            {t('help.send')}
          </Button>
        </Card>
      )}

      {staff ? (
        <>
          <SectionTitle>{t('facilitator.needsHelp')}</SectionTitle>
          {open.length === 0 ? (
            <Card>
              <p className="font-bold">{t('help.none')}</p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {open.map((row) => (
                <li key={row.id} className="rounded-xl2 border-2 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold">{row.learnerName ?? 'Learner'}</p>
                      <p className="text-sm muted">
                        {t(`help.${row.type === 'call_back' ? 'callback' : row.type}`)} · {formatDate(row.createdAt)}
                      </p>
                      {row.context ? (
                        <p className="mt-1 text-sm">{JSON.stringify(row.context)}</p>
                      ) : null}
                    </div>
                    <span className="chip">{t(`help.status.${row.status}`)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void update(row.id, 'contacted')}
                    >
                      {t('help.contact')}
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => void update(row.id, 'resolved')} icon={<Icon name="check" size={16} />}>
                      {t('help.resolve')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      <Card className="mt-5">
        <p className="font-bold">{t('voice.aiNotice')}</p>
        <p className="mt-1 text-sm muted">{t('scam.noCertainty')}</p>
      </Card>
    </div>
  );
}
