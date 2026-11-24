import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { apiDownload, apiFetch } from '../lib/api';
import { APP_NAME } from '../lib/config';
import { errorMessage } from '../lib/format';
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
  SectionTitle,
  Toggle,
} from '../components/ui';

interface ConsentRow {
  type: string;
  granted: boolean;
  createdAt: string;
}

const CONSENTS: Array<{ type: string; labelKey: string; description: string }> = [
  { type: 'terms', labelKey: 'privacy.terms', description: 'The rules for using this app.' },
  { type: 'privacy', labelKey: 'privacy.intro', description: 'How we look after your information.' },
  { type: 'ai_notice', labelKey: 'privacy.ai', description: 'You understand that the helper is an AI and can make mistakes.' },
  { type: 'store_transcripts', labelKey: 'privacy.transcripts', description: 'Keep the questions you type so a human helper can review them. Off by default.' },
  { type: 'family_link', labelKey: 'privacy.family', description: 'Let a family member you invite see the progress you choose.' },
  { type: 'analytics', labelKey: 'privacy.analytics', description: 'Use anonymous counts to improve lessons. No message content.' },
];

export default function Privacy() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data, error: loadError, loading, reload } = useAsync<ConsentRow[]>(async () => {
    const response = await apiFetch<{ consents: ConsentRow[] }>('/me/consents');
    return response.consents;
  }, []);

  if (!user) return <Navigate to="/auth" replace />;
  if (loading && !data) return <LoadingPage />;
  if (loadError) return <ErrorState message={errorMessage(loadError, t)} onRetry={reload} />;
  if (!data) return <LoadingPage />;

  const grantedFor = (type: string): boolean => {
    const rows = data.filter((row) => row.type === type);
    return rows.length > 0 ? Boolean(rows[rows.length - 1]?.granted) : false;
  };

  const setConsent = async (type: string, granted: boolean) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch('/me/consents', { method: 'POST', body: { type, granted } });
      setMessage(t('privacy.consentSaved'));
      reload();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    setError(null);
    try {
      await apiDownload('/me/export', `sabi-data-${user.id}.json`);
      setMessage(t('privacy.exportDone'));
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    setError(null);
    try {
      await apiFetch('/me', { method: 'DELETE' });
      await logout();
      navigate('/', { replace: true });
    } catch (caught) {
      setError(errorMessage(caught, t));
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="pb-6">
      <PageHeader title={t('privacy.title')} subtitle={t('privacy.intro')} backTo="/me" />

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

      <Notice variant="info" className="mb-5">
        {APP_NAME} collects only what it needs: your name or nickname, phone number, language and
        progress. We never ask for or keep your PIN, OTP, password, BVN, NIN or card details.
      </Notice>

      <div className="space-y-2">
        {CONSENTS.map((consent) => (
          <Toggle
            key={consent.type}
            label={t(consent.labelKey)}
            description={consent.description}
            checked={grantedFor(consent.type)}
            disabled={busy}
            onChange={(value) => void setConsent(consent.type, value)}
          />
        ))}
      </div>

      <SectionTitle>{t('privacy.retention')}</SectionTitle>
      <Card>
        <ul className="list-disc space-y-2 pl-5">
          <li>Nothing you type is recorded as audio. There is no microphone in this app.</li>
          <li>Questions are kept only if you turn on “Keep my questions”.</li>
          <li>Progress is kept while your account is open.</li>
          <li>You can export or delete everything from this page.</li>
        </ul>
      </Card>

      <SectionTitle>{t('me.export')}</SectionTitle>
      <div className="space-y-2">
        <Button
          variant="secondary"
          block
          loading={exporting}
          onClick={() => void exportData()}
          icon={<Icon name="download" />}
        >
          {t('me.export')}
        </Button>
        <Button variant="danger" block onClick={() => setDeleteOpen(true)} icon={<Icon name="trash" />}>
          {t('me.delete')}
        </Button>
      </div>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('me.delete')}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
              {t('action.cancel')}
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void deleteAccount()} icon={<Icon name="trash" />}>
              {t('action.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-lg font-bold">{t('me.deleteConfirm')}</p>
        <p className="mt-2 text-sm">{t('privacy.deleteWarning')}</p>
      </Dialog>
    </div>
  );
}
