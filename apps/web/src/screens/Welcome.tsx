import { Link, Navigate } from 'react-router-dom';
import { LANGUAGES, LANGUAGE_GREETINGS, LANGUAGE_NAMES, type Lang } from '@sabi/shared';
import { APP_NAME, APP_TAGLINE, homeForRole } from '../lib/config';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useSpeech } from '../lib/speech';
import { useInstallPrompt } from '../lib/pwa';
import { Icon } from '../components/Icon';
import { LinkButton, LoadingPage, Notice } from '../components/ui';

export default function Welcome() {
  const { user, loading } = useAuth();
  const { lang, setLang, t } = useI18n();
  const { speak, synthesisSupported } = useSpeech();
  const { available, installed, install } = useInstallPrompt();

  if (loading) return <LoadingPage />;
  if (user) return <Navigate to={homeForRole(user.role)} replace />;

  const choose = (code: Lang) => {
    setLang(code, { remote: false });
    if (synthesisSupported) speak(LANGUAGE_GREETINGS[code], { lang: code });
  };

  return (
    <div className="pb-6">
      <section className="mb-5 overflow-hidden rounded-xl2 border-4">
        <div className="grid-pattern border-b-2 px-5 py-8">
          <p className="eyebrow mb-2">{APP_NAME}</p>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">{APP_TAGLINE}</h1>
          <p className="mt-4 text-xl">{t('welcome.subtitle')}</p>
        </div>
        <div className="px-5 py-5">
          <p className="text-xl font-bold" lang={lang === 'yo' ? 'yo' : lang === 'ig' ? 'ig' : lang === 'pcm' ? 'en-NG' : 'en'}>
            {LANGUAGE_GREETINGS[lang]}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => speak(LANGUAGE_GREETINGS[lang])}
              className="btn btn-secondary"
              disabled={!synthesisSupported}
            >
              <Icon name="volume" />
              <span>{t('action.listen')}</span>
            </button>
            <span className="chip">
              <Icon name="globe" size={16} />
              {LANGUAGE_NAMES[lang]}
            </span>
          </div>
        </div>
      </section>

      <h2 className="mb-2 text-2xl font-bold">{t('welcome.chooseLanguage')}</h2>
      <div className="grid grid-cols-2 gap-3" role="group" aria-label={t('welcome.chooseLanguage')}>
        {LANGUAGES.map((code) => {
          const selected = code === lang;
          return (
            <button
              key={code}
              type="button"
              onClick={() => choose(code)}
              aria-pressed={selected}
              className={`flex min-h-[4.5rem] items-center justify-between gap-2 rounded-xl2 border-2 px-4 py-3 text-left text-lg font-bold ${
                selected ? 'bg-ink text-paper' : 'bg-paper text-ink'
              }`}
            >
              <span>
                {LANGUAGE_NAMES[code]}
                <span className={`mt-1 block text-xs font-normal ${selected ? '' : 'muted'}`}>
                  {LANGUAGE_GREETINGS[code].slice(0, 34)}…
                </span>
              </span>
              {selected ? <Icon name="check" size={22} /> : null}
            </button>
          );
        })}
      </div>
      <p className="hint mt-2">{t('welcome.langHint')}</p>

      <div className="mt-6 space-y-3">
        <LinkButton to="/auth" size="lg" block icon={<Icon name="mic" />}>
          {t('action.start')}
        </LinkButton>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/setup" className="link">
            {t('setup.title')}
          </Link>
          <Link to="/auth?staff=1" className="link">
            {t('auth.staffLogin')}
          </Link>
        </div>
      </div>

      {available ? (
        <Notice
          variant="info"
          className="mt-6"
          title={t('offline.install')}
          action={
            <button type="button" onClick={() => void install()} className="btn btn-secondary">
              <Icon name="install" />
              <span>{t('action.install')}</span>
            </button>
          }
        >
          <p>{t('offline.installHint')}</p>
        </Notice>
      ) : installed ? (
        <Notice variant="success" className="mt-6" title={t('offline.install')}>
          <p>{t('offline.installHint')}</p>
        </Notice>
      ) : null}

      <p className="mt-6 text-sm muted">
        {APP_NAME} is a practice helper, not a bank. We never ask for your PIN, OTP, password, BVN, NIN or card details.
      </p>
    </div>
  );
}
