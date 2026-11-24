import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import type { AssistantReply } from '@sabi/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { errorMessage } from '../lib/format';
import { useOnline } from '../lib/offline';
import { Icon } from '../components/Icon';
import { Button, Card, Notice, PageHeader } from '../components/ui';

export default function Ask() {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const online = useOnline();
  const location = useLocation();
  const context = (location.state as { context?: string } | null)?.context ?? '';

  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState<AssistantReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return <Navigate to="/auth" replace />;

  const send = async (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    setReply(null);
    try {
      const response = await apiFetch<AssistantReply>('/assistant/turn', {
        method: 'POST',
        body: { text: value, lang },
      });
      setReply(response);
      setQuestion('');
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-6">
      <PageHeader title={t('ask.title')} subtitle={t('ask.intro')} backTo="/home" />

      {!online ? (
        <Notice variant="warning" title={t('common.offline')} className="mb-4">
          <p>{t('ask.offline')}</p>
        </Notice>
      ) : null}

      {context ? (
        <Card className="mb-4">
          <p className="eyebrow mb-1">{t('lesson.stuckAsk')}</p>
          <p className="font-bold">{context}</p>
        </Card>
      ) : null}

      {error ? (
        <Notice variant="error" title={t('common.error')} className="mb-4">
          <p>{error}</p>
        </Notice>
      ) : null}

      {reply ? (
        <Card className="mb-4">
          <p className="text-2xl font-bold leading-snug">{reply.reply}</p>
          {reply.safety.message ? (
            <Notice variant="warning" className="mt-3">
              {reply.safety.message}
            </Notice>
          ) : null}
          {reply.replyLang !== lang ? (
            <p className="mt-2 text-sm muted">{t('translation.fallback')}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setReply(null)} icon={<Icon name="edit" />}>
              {t('ask.askAnother')}
            </Button>
            <Link to="/help" className="btn btn-ghost">
              <Icon name="users" />
              <span>{t('action.talkToPerson')}</span>
            </Link>
          </div>
        </Card>
      ) : null}

      <Card>
        <label className="label" htmlFor="ask-question">
          {t('ask.placeholder')}
        </label>
        <textarea
          id="ask-question"
          className="textarea"
          value={question}
          maxLength={600}
          placeholder={t('ask.placeholder')}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <Button
          className="mt-3"
          block
          disabled={!question.trim() || !online}
          loading={busy}
          onClick={() => void send(question)}
          icon={<Icon name="send" />}
        >
          {t('ask.send')}
        </Button>
      </Card>
    </div>
  );
}
