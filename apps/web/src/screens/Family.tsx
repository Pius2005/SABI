import { useState } from 'react';
import { Navigate } from 'react-router-dom';
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
  Toggle,
} from '../components/ui';

interface ConsentRow {
  type: string;
  granted: boolean;
  createdAt: string;
}

interface LinkRow {
  id: string;
  learnerId: string;
  familyId: string;
  status: 'pending' | 'active';
  scopeProgress: boolean;
  scopeScamAlerts: boolean;
  scopeTranscripts: boolean;
  consentedAt: string;
}

interface LearnerRow {
  linkId: string;
  status: 'pending' | 'active';
  learnerId: string;
  name: string;
  lang: string;
  scopeProgress: boolean;
  scopeScamAlerts: boolean;
  scopeTranscripts: boolean;
  progress: Array<{ lessonSlug: string; title: string; stepIndex: number; completed: boolean; updatedAt: string }>;
  lessonsCompleted: number;
}

export default function Family() {
  const { user } = useAuth();
  const { t, tf } = useI18n();
  const [phone, setPhone] = useState('');
  const [scopeProgress, setScopeProgress] = useState(true);
  const [scopeScamAlerts, setScopeScamAlerts] = useState(false);
  const [scopeTranscripts, setScopeTranscripts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [encourage, setEncourage] = useState<Record<string, string>>({});

  const { data, error: loadError, loading, reload } = useAsync<{
    consents: ConsentRow[];
    links: LinkRow[];
    learners: LearnerRow[];
  }>(async () => {
    const me = await apiFetch<{ consents: ConsentRow[]; familyLinks: LinkRow[] }>('/me');
    let learners: LearnerRow[] = [];
    if (user?.role === 'FAMILY' || user?.role === 'ADMIN' || user?.role === 'LEARNER') {
      try {
        const response = await apiFetch<{ links: LearnerRow[] }>('/family/learners');
        learners = response.links;
      } catch {
        learners = [];
      }
    }
    return { consents: me.consents, links: me.familyLinks, learners };
  }, [user?.id, user?.role]);

  if (!user) return <Navigate to="/auth" replace />;
  if (loading && !data) return <LoadingPage />;
  if (loadError) return <ErrorState message={errorMessage(loadError, t)} onRetry={reload} />;
  if (!data) return <LoadingPage />;

  const consentGranted = data.consents.some((row) => row.type === 'family_link' && row.granted);

  const setConsent = async (granted: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/me/consents', { method: 'POST', body: { type: 'family_link', granted } });
      reload();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/family/invite', {
        method: 'POST',
        body: { phone: phone.trim(), scopeProgress, scopeScamAlerts, scopeTranscripts },
      });
      setMessage(t('family.invited'));
      setPhone('');
      reload();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/family/${encodeURIComponent(id)}`, { method: 'DELETE' });
      setMessage(t('family.revoked'));
      reload();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const accept = async (linkId: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/family/accept', { method: 'POST', body: { linkId } });
      setMessage(t('family.linked'));
      reload();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const sendEncouragement = async (linkId: string) => {
    const text = (encourage[linkId] ?? '').trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/family/encourage', { method: 'POST', body: { linkId, message: text } });
      setMessage(t('action.send'));
      setEncourage((previous) => ({ ...previous, [linkId]: '' }));
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-6">
      <PageHeader title={t('family.title')} subtitle={t('family.intro')} backTo="/me" />

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

      <Notice variant="info" className="mb-4">
        A family helper can see progress, but never your PIN, OTP, password, BVN, NIN or card details.
        You can stop the link at any time.
      </Notice>

      {user.role === 'LEARNER' ? (
        <>
          <Card className="mb-5">
            <Toggle
              label={t('family.consentNeeded')}
              description={t('family.intro')}
              checked={consentGranted}
              disabled={busy}
              onChange={(value) => void setConsent(value)}
            />
          </Card>

          <SectionTitle>{t('family.invite')}</SectionTitle>
          <Card>
            <label className="label" htmlFor="family-phone">
              {t('family.phone')}
            </label>
            <input
              id="family-phone"
              className="input text-lg"
              type="tel"
              inputMode="tel"
              placeholder="0803 999 9999"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
            <p className="hint">
              Ask your family member to create a family account first, then enter their phone number here.
            </p>

            <div className="mt-4 space-y-2">
              <Toggle
                label={t('family.scopeProgress')}
                description="Which lessons you finished."
                checked={scopeProgress}
                onChange={setScopeProgress}
              />
              <Toggle
                label={t('family.scopeAlerts')}
                description="When you check a suspicious message."
                checked={scopeScamAlerts}
                onChange={setScopeScamAlerts}
              />
              <Toggle
                label={t('family.scopeTranscripts')}
                description="The words you said to the helper. This is private; leave it off unless you want it."
                checked={scopeTranscripts}
                onChange={setScopeTranscripts}
              />
            </div>

            <Button
              className="mt-4"
              block
              size="lg"
              disabled={!consentGranted || phone.trim().length < 7}
              loading={busy}
              onClick={() => void invite()}
              icon={<Icon name="send" />}
            >
              {t('family.invite')}
            </Button>
            {!consentGranted ? (
              <p className="mt-2 text-sm font-bold">{t('family.consentNeeded')}</p>
            ) : null}
          </Card>

          <SectionTitle>{t('family.linked')}</SectionTitle>
          {data.links.length === 0 ? (
            <Card>
              <p className="font-bold">{t('family.none')}</p>
            </Card>
          ) : (
            <ul className="space-y-2">
              {data.links.map((link) => (
                <li key={link.id} className="rounded-xl2 border-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">
                        {link.status === 'active' ? t('family.linked') : t('family.pending')}
                      </p>
                      <p className="text-sm muted">{formatDate(link.consentedAt)}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {link.scopeProgress ? <span className="chip">{t('family.scopeProgress')}</span> : null}
                        {link.scopeScamAlerts ? <span className="chip">{t('family.scopeAlerts')}</span> : null}
                        {link.scopeTranscripts ? <span className="chip">{t('family.scopeTranscripts')}</span> : null}
                      </div>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      onClick={() => void revoke(link.id)}
                      icon={<Icon name="x" size={16} />}
                    >
                      {t('family.revoke')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      {user.role === 'FAMILY' || user.role === 'ADMIN' ? (
        <>
          <SectionTitle>{t('facilitator.learners')}</SectionTitle>
          {data.learners.length === 0 ? (
            <Card>
              <p className="font-bold">{t('family.none')}</p>
              <p className="mt-1 text-sm muted">{t('family.intro')}</p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {data.learners.map((learner) => (
                <li key={learner.linkId} className="rounded-xl2 border-2 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 font-bold">
                      {learner.name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold leading-tight">{learner.name}</p>
                      <p className="text-sm muted">
                        {learner.lessonsCompleted} {t('common.lessons')} · {learner.status === 'active' ? t('family.linked') : t('family.pending')}
                      </p>
                    </div>
                  </div>

                  {learner.progress.length > 0 ? (
                    <ul className="mt-3 space-y-1 text-sm">
                      {learner.progress.slice(0, 4).map((row) => (
                        <li key={row.lessonSlug} className="flex items-center gap-2">
                          <Icon name={row.completed ? 'check-circle' : 'clock'} size={16} />
                          <span className="min-w-0 flex-1 truncate">{row.title}</span>
                          <span className="muted">{formatDate(row.updatedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {learner.status === 'pending' ? (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void accept(learner.linkId)}
                        icon={<Icon name="check" size={16} />}
                      >
                        {t('family.accept')}
                      </Button>
                    ) : null}
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy}
                      onClick={() => void revoke(learner.linkId)}
                      icon={<Icon name="x" size={16} />}
                    >
                      {t('family.revoke')}
                    </Button>
                  </div>

                  {learner.status === 'active' ? (
                    <div className="mt-3">
                      <label className="label" htmlFor={`encourage-${learner.linkId}`}>
                        Send a kind message
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <input
                          id={`encourage-${learner.linkId}`}
                          className="input flex-1"
                          maxLength={240}
                          value={encourage[learner.linkId] ?? ''}
                          onChange={(event) =>
                            setEncourage((previous) => ({ ...previous, [learner.linkId]: event.target.value }))
                          }
                          placeholder="Well done. Keep going small small."
                        />
                        <Button
                          variant="secondary"
                          disabled={busy || !(encourage[learner.linkId] ?? '').trim()}
                          onClick={() => void sendEncouragement(learner.linkId)}
                          icon={<Icon name="send" size={18} />}
                        >
                          {t('action.send')}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}

      <p className="mt-6 text-sm muted">
        {tf('progress.completed', { count: data.learners.reduce((sum, row) => sum + row.lessonsCompleted, 0) })}
      </p>
    </div>
  );
}
