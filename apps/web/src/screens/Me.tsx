import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { LANGUAGES, LANGUAGE_NAMES, type Lang, type TextSize, type Theme } from '@sabi/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useSettings } from '../lib/settings';
import { apiDownload, apiFetch } from '../lib/api';
import { roleLabel } from '../lib/config';
import { errorMessage } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Icon } from '../components/Icon';
import {
  Button,
  Card,
  Dialog,
  ErrorState,
  LinkButton,
  LoadingPage,
  Notice,
  PageHeader,
  RadioCards,
  SectionTitle,
  Toggle,
} from '../components/ui';

interface ConsentRow {
  type: string;
  granted: boolean;
  createdAt: string;
}

interface FamilyLinkRow {
  id: string;
  learnerId: string;
  familyId: string;
  status: 'pending' | 'active';
  scopeProgress: boolean;
  scopeScamAlerts: boolean;
  scopeTranscripts: boolean;
  consentedAt: string;
}

interface ReminderRow {
  channel: 'sms' | 'whatsapp' | 'in_app';
  weeklyDay: number;
  hour: number;
  quietStart: string;
  quietEnd: string;
  active: boolean;
}

interface MeData {
  consents: ConsentRow[];
  familyLinks: FamilyLinkRow[];
  reminder: ReminderRow | null;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function Me() {
  const { user, setUser, logout } = useAuth();
  const { lang, setLang, t } = useI18n();
  const { settings, updateSettings } = useSettings();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.displayName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [savedName, setSavedName] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [reminder, setReminder] = useState<ReminderRow | null>(null);
  const [savingReminder, setSavingReminder] = useState(false);
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

  const { data, error: loadError, loading, reload } = useAsync<MeData>(async () => {
    const response = await apiFetch<{ consents: ConsentRow[]; familyLinks: FamilyLinkRow[]; reminder: ReminderRow | null }>(
      '/me',
    );
    return { consents: response.consents, familyLinks: response.familyLinks, reminder: response.reminder };
  }, []);

  useEffect(() => {
    if (data?.reminder) setReminder(data.reminder);
  }, [data]);

  useEffect(() => {
    if (user) setName(user.displayName);
  }, [user?.id]);

  if (!user) return <Navigate to="/auth" replace />;
  if (loading && !data) return <LoadingPage />;
  if (loadError) return <ErrorState message={errorMessage(loadError, t)} onRetry={reload} />;

  const saveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    setError(null);
    setSavedName(false);
    try {
      const response = await apiFetch<{ user: typeof user }>('/me', {
        method: 'PATCH',
        body: { displayName: name.trim() },
      });
      setUser(response.user);
      setSavedName(true);
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setSavingName(false);
    }
  };

  const saveReminder = async (patch: Partial<ReminderRow>) => {
    const next: ReminderRow = {
      channel: 'sms',
      weeklyDay: 1,
      hour: 10,
      quietStart: '21:00',
      quietEnd: '07:00',
      active: true,
      ...(reminder ?? {}),
      ...patch,
    };
    setReminder(next);
    setSavingReminder(true);
    setReminderMessage(null);
    try {
      await apiFetch('/reminders', { method: 'PUT', body: next });
      setReminderMessage(t('common.saved'));
    } catch (caught) {
      setReminderMessage(errorMessage(caught, t));
    } finally {
      setSavingReminder(false);
    }
  };

  const testReminder = async () => {
    setSavingReminder(true);
    setReminderMessage(null);
    try {
      await apiFetch('/reminders/test', { method: 'POST' });
      setReminderMessage(t('common.saved'));
    } catch (caught) {
      setReminderMessage(errorMessage(caught, t));
    } finally {
      setSavingReminder(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    setError(null);
    try {
      await apiDownload('/me/export', `sabi-data-${user.id}.json`);
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
      <PageHeader title={t('me.title')} subtitle={t('me.profile')} backTo="/home" />

      {error ? (
        <Notice variant="error" title={t('common.error')} className="mb-4">
          {error}
        </Notice>
      ) : null}

      <Card className="mb-5">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 bg-ink text-2xl font-bold text-paper">
            {user.displayName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-bold leading-tight">{user.displayName}</p>
            <p className="text-sm muted">{roleLabel(user.role)}</p>
            {user.phoneMasked ? (
              <p className="text-sm muted">
                {t('me.phone')}: {user.phoneMasked}
              </p>
            ) : null}
            {user.email ? <p className="text-sm muted">{user.email}</p> : null}
          </div>
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="me-name">
            {t('common.name')}
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="me-name"
              className="input flex-1"
              value={name}
              maxLength={60}
              onChange={(event) => {
                setName(event.target.value);
                setSavedName(false);
              }}
            />
            <Button
              variant="secondary"
              loading={savingName}
              disabled={!name.trim() || name.trim() === user.displayName}
              onClick={() => void saveName()}
              icon={<Icon name="check" />}
            >
              {t('action.save')}
            </Button>
          </div>
          {savedName ? (
            <p className="mt-2 flex items-center gap-1 text-sm font-bold" role="status">
              <Icon name="check-circle" size={16} />
              {t('me.saved')}
            </p>
          ) : null}
        </div>
      </Card>

      <SectionTitle id="language">{t('common.language')}</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {LANGUAGES.map((code) => {
          const active = lang === code;
          return (
            <button
              key={code}
              type="button"
              aria-pressed={active}
              onClick={() => setLang(code as Lang)}
              className={`flex min-h-[3.5rem] items-center justify-between rounded-xl2 border-2 px-4 py-2 text-left font-bold ${
                active ? 'bg-ink text-paper' : 'bg-paper text-ink'
              }`}
            >
              {LANGUAGE_NAMES[code]}
              {active ? <Icon name="check" size={20} /> : null}
            </button>
          );
        })}
      </div>

      <SectionTitle>{t('me.settings')}</SectionTitle>
      <div className="space-y-4">
        <RadioCards<TextSize>
          name="me-text"
          label={t('me.textSize')}
          value={settings.textSize}
          onChange={(value) => updateSettings({ textSize: value })}
          options={[
            { value: 'normal', label: t('setup.normal') },
            { value: 'large', label: t('setup.large') },
            { value: 'xl', label: t('setup.xl') },
          ]}
          columns={3}
        />
        <RadioCards<Theme>
          name="me-theme"
          label={t('me.theme')}
          value={settings.theme}
          onChange={(value) => updateSettings({ theme: value })}
          options={[
            { value: 'light', label: t('setup.light'), icon: <Icon name="sun" /> },
            { value: 'inverted', label: t('setup.inverted'), icon: <Icon name="moon" /> },
          ]}
          columns={2}
        />
        <RadioCards<'slow' | 'normal' | 'fast'>
          name="me-speed"
          label={t('me.voiceSpeed')}
          value={settings.voiceSpeed < 0.8 ? 'slow' : settings.voiceSpeed > 1.02 ? 'fast' : 'normal'}
          onChange={(value) =>
            updateSettings({ voiceSpeed: value === 'slow' ? 0.7 : value === 'fast' ? 1.15 : 0.9 })
          }
          options={[
            { value: 'slow', label: t('setup.slow') },
            { value: 'normal', label: t('setup.normalSpeed') },
            { value: 'fast', label: t('setup.fast') },
          ]}
          columns={3}
        />
        <Toggle
          label={t('me.autoRead')}
          checked={settings.autoRead}
          onChange={(value) => updateSettings({ autoRead: value })}
        />
        <Toggle
          label={t('me.reduceMotion')}
          checked={settings.reduceMotion}
          onChange={(value) => updateSettings({ reduceMotion: value })}
        />
        <LinkButton to="/setup" variant="secondary" block icon={<Icon name="settings" />}>
          {t('setup.title')}
        </LinkButton>
      </div>

      <SectionTitle>{t('me.family')}</SectionTitle>
      <Card>
        <p className="font-bold">{t('family.title')}</p>
        <p className="mt-1 text-sm muted">{t('family.intro')}</p>
        {data && data.familyLinks.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {data.familyLinks.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-2 rounded-xl border-2 p-2 text-sm">
                <span className="font-bold">
                  {link.status === 'active' ? t('family.linked') : t('family.pending')}
                </span>
                <span className="chip">{link.scopeProgress ? t('family.scopeProgress') : t('family.none')}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <LinkButton
            to="/family"
            variant="secondary"
            size="sm"
            icon={<Icon name="heart" size={18} />}
          >
            {t('family.title')}
          </LinkButton>
          <LinkButton to="/offline" variant="ghost" size="sm" icon={<Icon name="download" size={18} />}>
            {t('offline.title')}
          </LinkButton>
        </div>
      </Card>

      <SectionTitle>Reminders</SectionTitle>
      <Card>
        <p className="font-bold">Learning reminder</p>
        <p className="mt-1 text-sm muted">
          A gentle message each week. You can turn it off at any time. Quiet hours stop night messages.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="reminder-channel">
              How should we remind you?
            </label>
            <select
              id="reminder-channel"
              className="select"
              value={reminder?.channel ?? 'sms'}
              onChange={(event) => void saveReminder({ channel: event.target.value as ReminderRow['channel'] })}
            >
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="in_app">In the app only</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="reminder-day">
              Day
            </label>
            <select
              id="reminder-day"
              className="select"
              value={reminder?.weeklyDay ?? 1}
              onChange={(event) => void saveReminder({ weeklyDay: Number(event.target.value) })}
            >
              {DAYS.map((day, index) => (
                <option key={day} value={index}>
                  {day}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="reminder-hour">
              Hour (0–23)
            </label>
            <input
              id="reminder-hour"
              className="input"
              type="number"
              min={0}
              max={23}
              value={reminder?.hour ?? 10}
              onChange={(event) => void saveReminder({ hour: Number(event.target.value) })}
            />
          </div>
          <div>
            <label className="label" htmlFor="reminder-active">
              Reminder on
            </label>
            <select
              id="reminder-active"
              className="select"
              value={reminder?.active === false ? 'off' : 'on'}
              onChange={(event) => void saveReminder({ active: event.target.value === 'on' })}
            >
              <option value="on">{t('setup.on')}</option>
              <option value="off">{t('setup.off')}</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={savingReminder}
            onClick={() => void saveReminder({})}
            icon={<Icon name="check" size={18} />}
          >
            {t('action.save')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!reminder}
            loading={savingReminder}
            onClick={() => void testReminder()}
            icon={<Icon name="bell" size={18} />}
          >
            Send a test
          </Button>
        </div>
        {reminderMessage ? (
          <p className="mt-2 text-sm font-bold" role="status">
            {reminderMessage}
          </p>
        ) : null}
      </Card>

      <SectionTitle>{t('privacy.title')}</SectionTitle>
      <div className="space-y-2">
        <LinkButton to="/privacy" variant="secondary" block icon={<Icon name="lock" />}>
          {t('me.privacy')}
        </LinkButton>
        <Button
          variant="secondary"
          block
          loading={exporting}
          onClick={() => void exportData()}
          icon={<Icon name="download" />}
        >
          {t('me.export')}
        </Button>
        <Link to="/help" className="btn btn-secondary btn-block">
          <Icon name="users" />
          <span>{t('help.title')}</span>
        </Link>
      </div>

      <SectionTitle>{t('action.logout')}</SectionTitle>
      <div className="space-y-2">
        <Button
          variant="secondary"
          block
          onClick={() => void logout().then(() => navigate('/', { replace: true }))}
          icon={<Icon name="logout" />}
        >
          {t('me.logout')}
        </Button>
        <Button
          variant="danger"
          block
          onClick={() => setDeleteOpen(true)}
          icon={<Icon name="trash" />}
        >
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
