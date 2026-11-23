import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { DEMO_STAFF, IS_DEMO, homeForRole } from '../lib/config';
import { errorMessage } from '../lib/format';
import { Icon } from '../components/Icon';
import { Button, LoadingPage, Notice, PageHeader, Toggle } from '../components/ui';

type Tab = 'learner' | 'staff';

function safeNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export default function Auth() {
  const { user, loading, requestOtp, verifyOtp, staffLogin } = useAuth();
  const { lang, t, tf } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [tab, setTab] = useState<Tab>(params.get('staff') === '1' ? 'staff' : 'learner');

  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [helper, setHelper] = useState(false);
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staffBusy, setStaffBusy] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  const busy = sending || verifying || staffBusy;
  const errorText = useMemo(() => (error ? errorMessage(error, t) : null), [error, t]);

  if (loading) return <LoadingPage />;
  if (user && !busy) return <Navigate to={next ?? homeForRole(user.role)} replace />;

  const sendCode = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await requestOtp(phone.trim(), name.trim() || undefined, lang);
      setDevCode(result.devCode ?? null);
      setResendIn(result.resendIn || 60);
      setStep('code');
    } catch (caught) {
      setError(caught);
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyOtp({
        phone: phone.trim(),
        code: code.trim(),
        displayName: name.trim() || undefined,
        lang,
        agree,
        helper,
      });
      if (result.isNew || !result.user.goalPathSlug) navigate('/goals', { replace: true });
      else navigate(next ?? homeForRole(result.user.role), { replace: true });
    } catch (caught) {
      setError(caught);
      setVerifying(false);
    }
  };

  const loginStaff = async () => {
    setStaffBusy(true);
    setError(null);
    try {
      const loggedIn = await staffLogin(email.trim(), password);
      navigate(next ?? homeForRole(loggedIn.role), { replace: true });
    } catch (caught) {
      setError(caught);
      setStaffBusy(false);
    }
  };

  return (
    <div className="pb-6">
      <PageHeader title={t('auth.title')} subtitle={t('auth.helperNote')} backTo="/" />

      <div className="mb-5 grid grid-cols-2 gap-2" role="tablist" aria-label={t('auth.title')}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'learner'}
          onClick={() => {
            setTab('learner');
            setError(null);
          }}
          className={`btn ${tab === 'learner' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Icon name="phone" size={20} />
          <span>{t('auth.phoneLabel')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'staff'}
          onClick={() => {
            setTab('staff');
            setError(null);
          }}
          className={`btn ${tab === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Icon name="user" size={20} />
          <span>{t('auth.staffLogin')}</span>
        </button>
      </div>

      {errorText ? (
        <Notice variant="error" title={t('common.error')} className="mb-4">
          <p>{errorText}</p>
        </Notice>
      ) : null}

      {tab === 'learner' ? (
        <div className="space-y-4">
          <Notice variant="info">{t('auth.helperNote')}</Notice>

          {step === 'phone' ? (
            <>
              <div>
                <label className="label" htmlFor="phone">
                  {t('auth.phoneLabel')}
                </label>
                <input
                  id="phone"
                  className="input text-xl"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0803 000 0000"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
                <p className="hint">{t('auth.phoneHint')}</p>
              </div>

              <div>
                <label className="label" htmlFor="name">
                  {t('common.name')} <span className="font-normal muted">({t('common.optional')})</span>
                </label>
                <input
                  id="name"
                  className="input text-xl"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={60}
                />
              </div>

              <Toggle label={t('auth.helperMode')} checked={helper} onChange={setHelper} />

              <label className="flex items-start gap-3 rounded-xl2 border-2 p-4">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(event) => setAgree(event.target.checked)}
                  className="mt-1 h-6 w-6 shrink-0 accent-ink"
                />
                <span>
                  <span className="block font-bold">{t('auth.agree')}</span>
                  <span className="mt-1 block text-sm muted">{t('auth.consentIntro')}</span>
                  <Link to="/privacy" className="link mt-1 inline-block text-sm">
                    {t('privacy.title')}
                  </Link>
                </span>
              </label>

              <Button
                size="lg"
                block
                loading={sending}
                onClick={() => void sendCode()}
                icon={<Icon name="message" />}
              >
                {t('auth.sendCode')}
              </Button>
            </>
          ) : (
            <>
              <div>
                <label className="label" htmlFor="code">
                  {t('auth.codeLabel')}
                </label>
                <input
                  id="code"
                  className="input text-center text-3xl tracking-[0.35em]"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                />
                <p className="hint">
                  {t('auth.phoneLabel')}: {phone}
                </p>
              </div>

              {devCode ? (
                <Notice variant="warning" title="Demo code">
                  <p className="text-2xl font-bold tracking-widest">{devCode}</p>
                  <p className="mt-1 text-sm">Shown only because the mock SMS provider is active in development.</p>
                </Notice>
              ) : null}

              <Button
                size="lg"
                block
                loading={verifying}
                onClick={() => void verify()}
                icon={<Icon name="check" />}
              >
                {t('auth.verify')}
              </Button>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStep('phone');
                    setCode('');
                    setError(null);
                  }}
                  icon={<Icon name="back" />}
                >
                  {t('auth.backToPhone')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={resendIn > 0 || sending}
                  loading={sending}
                  onClick={() => void sendCode()}
                >
                  {resendIn > 0 ? tf('auth.resendIn', { seconds: resendIn }) : t('auth.resend')}
                </Button>
              </div>
            </>
          )}

          <p className="text-sm muted">
            We will never ask for your PIN, OTP, password, BVN, NIN or card details. The code is only for logging in.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="email">
              {t('common.email')}
            </label>
            <input
              id="email"
              className="input text-lg"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              {t('common.password')}
            </label>
            <input
              id="password"
              className="input text-lg"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="hint">{t('auth.staffHint')}</p>
          </div>
          <Button
            size="lg"
            block
            loading={staffBusy}
            onClick={() => void loginStaff()}
            icon={<Icon name="lock" />}
          >
            {t('auth.login')}
          </Button>

          {IS_DEMO ? (
            <details className="rounded-xl2 border-2 p-4">
              <summary className="cursor-pointer font-bold">Demo staff accounts</summary>
              <ul className="mt-3 space-y-2 text-sm">
                {DEMO_STAFF.map((account) => (
                  <li key={account.email} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong>{account.role}</strong>: {account.email} / {account.password}
                    </span>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setEmail(account.email);
                        setPassword(account.password);
                      }}
                    >
                      Use
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      )}

      <p className="mt-6 text-sm muted">
        {t('auth.helperNote')} <Link to="/privacy" className="link">{t('privacy.title')}</Link>
      </p>
    </div>
  );
}
