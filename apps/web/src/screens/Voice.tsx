import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import type { VoiceReply } from '@sabi/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { errorMessage } from '../lib/format';
import { useOnline } from '../lib/offline';
import { useSpeech } from '../lib/speech';
import { Icon } from '../components/Icon';
import { Button, Card, Notice, PageHeader } from '../components/ui';

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function Voice() {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const online = useOnline();
  const location = useLocation();
  const context = (location.state as { context?: string } | null)?.context ?? '';
  const { startListening, stopListening, listening, speak, stopSpeaking, speaking, synthesisSupported, interim, error: speechError } =
    useSpeech();

  const [transcript, setTranscript] = useState('');
  const [typed, setTyped] = useState('');
  const [reply, setReply] = useState<VoiceReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTyped, setShowTyped] = useState(false);
  const lastSpoken = useRef<string>('');

  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  if (!user) return <Navigate to="/auth" replace />;

  const send = async (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    stopListening();
    setBusy(true);
    setError(null);
    setTranscript(value);
    setReply(null);
    try {
      const response = await apiFetch<VoiceReply>('/voice/turn', {
        method: 'POST',
        body: { text: value, lang },
      });
      setReply(response);
      if (response.reply && lastSpoken.current !== response.reply) {
        lastSpoken.current = response.reply;
        speak(response.reply, { lang: response.replyLang });
      }
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (yes: boolean) => {
    if (!reply || !yes) {
      setReply(null);
      setTranscript('');
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch<VoiceReply>('/voice/confirm', {
        method: 'POST',
        body: { text: reply.transcript || 'yes', lang },
      });
      setReply(response);
      if (response.reply) speak(response.reply, { lang: response.replyLang });
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const listen = () => {
    setError(null);
    setReply(null);
    const started = startListening(
      {
        onResult: (text) => {
          void send(text);
        },
        onError: (code) => {
          if (code === 'unsupported') {
            setShowTyped(true);
            setError(t('voice.error'));
          } else if (code === 'permission') {
            setShowTyped(true);
            setError(t('voice.error'));
          } else if (code === 'no-speech' || code === 'aborted') {
            /* stay quiet */
          } else {
            setError(t('voice.error'));
          }
        },
      },
      { lang },
    );
    if (!started) setShowTyped(true);
  };

  const phase: Phase = busy ? 'thinking' : listening ? 'listening' : speaking ? 'speaking' : 'idle';
  const statusText =
    phase === 'listening'
      ? t('voice.listening')
      : phase === 'thinking'
        ? t('voice.thinking')
        : phase === 'speaking'
          ? t('voice.speaking')
          : t('voice.idle');

  return (
    <div className="pb-6">
      <PageHeader title={t('voice.title')} subtitle={t('voice.intro')} backTo="/home" />

      {!online ? (
        <Notice variant="warning" title={t('common.offline')} className="mb-4">
          <p>{t('voice.offline')}</p>
        </Notice>
      ) : null}

      {context ? (
        <Card className="mb-4">
          <p className="eyebrow mb-1">{t('lesson.stuckAsk')}</p>
          <p className="font-bold">{context}</p>
        </Card>
      ) : null}

      <div className="mb-4 flex flex-col items-center">
        <button
          type="button"
          onClick={() => {
            if (listening) stopListening();
            else if (speaking) stopSpeaking();
            else listen();
          }}
          disabled={!online || busy}
          aria-label={listening ? t('voice.tapToStop') : t('voice.tapToSpeak')}
          className={`flex h-40 w-40 items-center justify-center rounded-full border-4 bg-ink text-paper disabled:opacity-40 ${
            listening ? 'speak-pulse' : ''
          }`}
        >
          <Icon name={listening ? 'stop' : 'mic'} size={64} />
        </button>
        <p className="mt-3 text-xl font-bold" role="status" aria-live="polite">
          {statusText}
        </p>
        {interim ? <p className="mt-1 text-center text-lg muted">{interim}</p> : null}
      </div>

      {speechError && !error ? (
        <Notice variant="warning" className="mb-4">
          {t('voice.error')}
        </Notice>
      ) : null}

      {error ? (
        <Notice variant="error" title={t('common.error')} className="mb-4">
          <p>{error}</p>
        </Notice>
      ) : null}

      {transcript ? (
        <Card className="mb-4">
          <p className="eyebrow mb-1">{t('voice.understood')}</p>
          <p className="text-xl font-bold">{transcript}</p>
        </Card>
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
            {synthesisSupported ? (
              <Button
                variant="secondary"
                onClick={() =>
                  speaking ? stopSpeaking() : speak(reply.reply, { lang: reply.replyLang })
                }
                icon={<Icon name={speaking ? 'stop' : 'volume'} />}
              >
                {speaking ? t('action.stop') : t('action.listen')}
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setShowTyped(true)} icon={<Icon name="edit" />}>
              {t('voice.typeInstead')}
            </Button>
          </div>

          {reply.needsConfirm ? (
            <div className="mt-4 rounded-xl2 border-2 border-dashed p-4">
              <p className="font-bold">{t('voice.confirm')}</p>
              {reply.confirmQuestion ? <p className="mt-1">{reply.confirmQuestion}</p> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => void confirm(true)} icon={<Icon name="check" />}>
                  {t('voice.confirmYes')}
                </Button>
                <Button variant="secondary" onClick={() => void confirm(false)} icon={<Icon name="x" />}>
                  {t('voice.confirmNo')}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={listen} disabled={!online || busy} icon={<Icon name="mic" />}>
              {t('action.askQuestion')}
            </Button>
            <Link to="/help" className="btn btn-ghost">
              <Icon name="users" />
              <span>{t('action.talkToPerson')}</span>
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="mb-4">
        <Button variant="ghost" onClick={() => setShowTyped((value) => !value)} icon={<Icon name="edit" />}>
          {t('voice.typeInstead')}
        </Button>
      </div>

      {showTyped ? (
        <Card>
          <label className="label" htmlFor="voice-typed">
            {t('voice.typeInstead')}
          </label>
          <textarea
            id="voice-typed"
            className="textarea"
            value={typed}
            maxLength={600}
            placeholder={t('voice.placeholder')}
            onChange={(event) => setTyped(event.target.value)}
          />
          <Button
            className="mt-3"
            block
            disabled={!typed.trim() || !online}
            loading={busy}
            onClick={() => {
              const value = typed;
              setTyped('');
              void send(value);
            }}
            icon={<Icon name="send" />}
          >
            {t('voice.send')}
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
