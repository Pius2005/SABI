import { useEffect } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@sabi/shared';
import { APP_NAME, homeForRole } from '../lib/config';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useOnline } from '../lib/offline';
import { useSettings } from '../lib/settings';
import { Icon, type IconName } from './Icon';
import { LinkButton, LoadingPage, Notice } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
}

function navFor(role: Role): NavItem[] {
  if (role === 'ADMIN') {
    return [
      { to: '/admin', label: 'Admin', icon: 'chart' },
      { to: '/facilitator', label: 'Groups', icon: 'users' },
      { to: '/help', label: 'Help', icon: 'help' },
      { to: '/me', label: 'Me', icon: 'user' },
    ];
  }
  if (role === 'FACILITATOR') {
    return [
      { to: '/facilitator', label: 'Groups', icon: 'users' },
      { to: '/help', label: 'Help', icon: 'help' },
      { to: '/me', label: 'Me', icon: 'user' },
    ];
  }
  if (role === 'FAMILY') {
    return [
      { to: '/family', label: 'Family', icon: 'heart' },
      { to: '/help', label: 'Help', icon: 'help' },
      { to: '/me', label: 'Me', icon: 'user' },
    ];
  }
  return [
    { to: '/home', label: 'Home', icon: 'home', end: true },
    { to: '/paths', label: 'Learn', icon: 'book' },
    { to: '/help', label: 'Help', icon: 'help' },
    { to: '/me', label: 'Me', icon: 'user' },
  ];
}

function TranslationBanner() {
  const { notice, lang, t } = useI18n();
  if (!notice || lang === 'en') return null;
  return (
    <div className="bg-ink text-paper">
      <div className="mx-auto flex max-w-3xl items-start gap-2 px-4 py-2 text-sm">
        <Icon name="alert" size={18} className="mt-0.5 shrink-0" />
        <p>{t('translation.notice')}</p>
      </div>
    </div>
  );
}

function BottomNav({ role }: { role: Role }) {
  const items = navFor(role);
  return (
    <nav
      aria-label="Main"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t-2 bg-paper pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex w-full max-w-3xl">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="nav-item">
            <Icon name={item.icon} size={26} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function AppShell() {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const { settings } = useSettings();
  const online = useOnline();

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="app-header no-print sticky top-0 z-30 border-b-2 bg-paper">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-2">
          <Link to={user ? homeForRole(user.role) : '/'} className="flex min-h-[3rem] items-center gap-2 no-underline">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border-2 bg-ink text-lg font-bold text-paper">
              S
            </span>
            <span className="text-xl font-bold leading-none">{APP_NAME}</span>
          </Link>
          <div className="flex items-center gap-2">
            {!online ? (
              <span className="chip" title={t('common.offline')}>
                <Icon name="wifi-off" size={16} />
                <span className="hidden sm:inline">{t('common.offline')}</span>
              </span>
            ) : null}
            <Link
              to={user ? '/me#language' : '/setup'}
              className="btn btn-secondary btn-sm"
              aria-label={`${t('common.language')}: ${lang.toUpperCase()}`}
            >
              <Icon name="globe" size={18} />
              <span>{lang.toUpperCase()}</span>
            </Link>
          </div>
        </div>
      </header>

      <TranslationBanner />

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-32 pt-4">
        <Outlet />
      </main>

      <footer className="app-footer no-print border-t-2 px-4 py-5 pb-28">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 text-sm">
          <p className="flex items-start gap-2">
            <Icon name="info" size={18} className="mt-0.5 shrink-0" />
            <span>{t('voice.aiNotice')}</span>
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/privacy" className="link">
              {t('privacy.title')}
            </Link>
            <Link to="/offline" className="link">
              {t('offline.title')}
            </Link>
            <span className="muted">
              {APP_NAME} · {settings.theme === 'inverted' ? t('setup.inverted') : t('setup.light')}
            </span>
          </div>
        </div>
      </footer>

      {user ? <BottomNav role={user.role} /> : null}
    </div>
  );
}

export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingPage />;
  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/auth?next=${next}`} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <Notice
        variant="warning"
        title="You do not have access to this page."
        action={
          <LinkButton to={homeForRole(user.role)} variant="secondary">
            Go to my home page
          </LinkButton>
        }
      >
        <p>Ask an administrator if you think this is a mistake.</p>
      </Notice>
    );
  }
  return <Outlet />;
}

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}
