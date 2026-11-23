import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { ScamVerdict } from '@sabi/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { errorMessage } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { SpeakButton } from '../components/SpeakButton';
import { Icon } from '../components/Icon';
import { Button, Card, Notice, PageHeader, Spinner } from '../components/ui';

interface ScamExample {
  id: string;
  type: string;
  lang: string;
  text: string;
  isScam: boolean;
  redFlags: string[];
}

const VERDICT_STYLE: Record<
  ScamVerdict['verdict'],
  { icon: 'alert' | 'help' | 'shield'; label: string }
> = {
  scam: { icon: 'alert', label: 'This looks like a scam' },
  unsure: { icon: 'help', label: 'Be careful. I am not sure.' },
  safe: { icon: 'shield', label: 'This looks normal' },
};

export default function Scam() {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const [text, setText] = useState('');
  const [result, setResult] = useState<ScamVerdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: examples } = useAsync<ScamExample[]>(async () => {
    try {
      const response = await apiFetch<{ examples: ScamExample[] }>(
        `/scam/examples?lang=${encodeURIComponent(lang)}`,
      );
      const list = response.examples.filter((example) => example.lang === lang);
      return (list.length ? list : response.examples).slice(0, 4);
    } catch {
      return [];
    }
  }, [lang]);

  if (!user) return <Navigate to="/auth" replace />;

  const check = async () => {
    if (text.trim().length < 2) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await apiFetch<ScamVerdict>('/scam/check', {
        method: 'POST',
        body: { text: text.trim() },
      });
      setResult(response);
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const verdictStyle = result ? VERDICT_STYLE[result.verdict] : null;

  return (
    <div className="pb-6">
      <PageHeader title={t('scam.title')} subtitle={t('scam.intro')} backTo="/home" />

      <Notice variant="info" className="mb-4" title={t('scam.noCertainty')}>
        <p>
          Never share your PIN, OTP, password, BVN, NIN or card details. This checker only looks at the
          words in a message. It cannot see who really sent it.
        </p>
      </Notice>

      <Card className="mb-4">
        <label className="label" htmlFor="scam-text">
          {t('scam.placeholder')}
        </label>
        <textarea
          id="scam-text"
          className="textarea"
          value={text}
          maxLength={2000}
          placeholder={t('scam.placeholder')}
          onChange={(event) => {
            setText(event.target.value);
            setResult(null);
          }}
        />
        <p className="hint">
          {t('scam.typeLabel')}: {text.length} / 2000
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="lg"
            disabled={text.trim().length < 2}
            loading={busy}
            onClick={() => void check()}
            icon={<Icon name="search" />}
          >
            {busy ? t('scam.checking') : t('scam.check')}
          </Button>
          <SpeakButton text={text} label={t('scam.speak')} />
        </div>
        {error ? (
          <Notice variant="error" title={t('common.error')} className="mt-3">
            {error}
          </Notice>
        ) : null}
      </Card>

      {examples && examples.length > 0 ? (
        <div className="mb-4">
          <p className="mb-2 font-bold">{t('common.practice')}</p>
          <div className="flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example.id}
                type="button"
                onClick={() => {
                  setText(example.text);
                  setResult(null);
                }}
                className="chip max-w-full whitespace-normal text-left"
              >
                <Icon name="message" size={14} />
                {example.text.slice(0, 52)}
                {example.text.length > 52 ? '…' : ''}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {busy ? (
        <div className="flex items-center gap-3 py-4" role="status">
          <Spinner size={26} />
          <span className="font-bold">{t('scam.checking')}</span>
        </div>
      ) : null}

      {result && verdictStyle ? (
        <Card className="mb-4" as="section">
          <div className="flex items-start gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2">
              <Icon name={verdictStyle.icon} size={30} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">{t('scam.result')}</p>
              <h2 className="text-2xl font-bold leading-tight">{result.headline || verdictStyle.label}</h2>
              <p className="mt-1 text-sm muted">
                {verdictStyle.label} · {Math.round(result.confidence * 100)}%
              </p>
            </div>
          </div>

          {result.critical ? (
            <Notice variant="error" className="mt-4" title="Stop. Do not reply.">
              This message asks for something secret, or it is trying to rush you. Do not reply, do not
              press any link, and do not send money.
            </Notice>
          ) : null}

          {result.reasons.length > 0 ? (
            <div className="mt-4">
              <h3 className="font-bold">{t('scam.reasons')}</h3>
              <ul className="mt-2 space-y-1">
                {result.reasons.map((reason) => (
                  <li key={reason} className="flex items-start gap-2">
                    <Icon name="alert" size={18} className="mt-1 shrink-0" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.nextSteps.length > 0 ? (
            <div className="mt-4">
              <h3 className="font-bold">{t('scam.nextSteps')}</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-6">
                {result.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {result.redFlags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {result.redFlags.map((flag) => (
                <span key={flag} className="chip">
                  <Icon name="flag" size={14} />
                  {flag.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          ) : null}

          <div className="mt-4">
            <SpeakButton
              text={`${result.headline}. ${result.reasons.join('. ')}. ${result.nextSteps.join('. ')}`}
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null);
                setText('');
              }}
              icon={<Icon name="refresh" />}
            >
              {t('scam.again')}
            </Button>
            <Link to="/help" className="btn btn-secondary">
              <Icon name="users" />
              <span>{t('action.talkToPerson')}</span>
            </Link>
          </div>
        </Card>
      ) : null}

      <Card>
        <p className="font-bold">{t('scam.askPerson')}</p>
        <p className="mt-1 text-sm">{t('scam.noCertainty')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to="/help" className="btn btn-secondary btn-sm">
            <Icon name="phone" size={18} />
            <span>{t('help.callback')}</span>
          </Link>
          <Link to="/voice" className="btn btn-ghost btn-sm">
            <Icon name="mic" size={18} />
            <span>{t('action.askQuestion')}</span>
          </Link>
        </div>
      </Card>
    </div>
  );
}
