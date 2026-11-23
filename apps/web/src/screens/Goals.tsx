import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { GOALS } from '@sabi/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { errorMessage } from '../lib/format';
import { Icon, type IconName } from '../components/Icon';
import { Button, Notice, PageHeader } from '../components/ui';

const GOAL_ICONS: Record<string, IconName> = {
  family: 'call',
  whatsapp: 'chat',
  banking: 'bank',
  scams: 'shield',
  basics: 'phone',
  services: 'globe',
};

export default function Goals() {
  const { user, setUser } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(user?.goalPathSlug ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return <Navigate to="/auth" replace />;

  const start = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const goal = GOALS.find((item) => item.id === selected);
      const response = await apiFetch<{ user: typeof user }>('/me', {
        method: 'PATCH',
        body: { goalPathSlug: goal?.pathSlug ?? null },
      });
      setUser(response.user);
      navigate(goal ? `/paths/${goal.pathSlug}` : '/home', { replace: true });
    } catch (caught) {
      setError(errorMessage(caught, t));
      setSaving(false);
    }
  };

  return (
    <div className="pb-6">
      <PageHeader
        title={t('goals.title')}
        subtitle={t('goals.intro')}
        eyebrow={user.displayName}
      />

      <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t('goals.title')}>
        {GOALS.map((goal) => {
          const active = selected === goal.id;
          return (
            <button
              key={goal.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(goal.id)}
              className={`flex min-h-[6rem] items-center gap-4 rounded-xl2 border-2 p-4 text-left ${
                active ? 'bg-ink text-paper' : 'bg-paper text-ink'
              }`}
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2">
                <Icon name={GOAL_ICONS[goal.id] ?? 'star'} size={28} />
              </span>
              <span className="min-w-0 flex-1 text-lg font-bold">{t(goal.titleKey)}</span>
              {active ? <Icon name="check" size={24} /> : null}
            </button>
          );
        })}
      </div>

      {error ? (
        <Notice variant="error" title={t('common.error')} className="mt-4">
          {error}
        </Notice>
      ) : null}

      <div className="mt-6 space-y-3">
        <Button
          size="lg"
          block
          disabled={!selected}
          loading={saving}
          onClick={() => void start()}
          icon={<Icon name="arrow-right" />}
        >
          {t('goals.start')}
        </Button>
        <Button variant="ghost" block onClick={() => navigate('/home')}>
          {t('action.cancel')}
        </Button>
      </div>
    </div>
  );
}
