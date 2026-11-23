import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { TextSize, Theme } from '@sabi/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useSettings } from '../lib/settings';
import { apiFetch } from '../lib/api';
import { SpeakButton } from '../components/SpeakButton';
import { Icon } from '../components/Icon';
import {
  Button,
  Notice,
  PageHeader,
  RadioCards,
  Toggle,
} from '../components/ui';

export default function Setup() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { settings, updateSettings } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finish = async () => {
    setSaving(true);
    setError(null);
    try {
      if (user) {
        await apiFetch('/me', {
          method: 'PATCH',
          body: {
            textSize: settings.textSize,
            theme: settings.theme,
            voiceSpeed: settings.voiceSpeed,
            autoRead: settings.autoRead,
            reduceMotion: settings.reduceMotion,
            preferredLang: settings.preferredLang,
          },
        });
        setSaved(true);
        const from = (location.state as { from?: string } | null)?.from;
        navigate(from === 'me' ? '/me' : '/home');
      } else {
        navigate('/auth');
      }
    } catch {
      setError(t('errors.network'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pb-6">
      <PageHeader
        title={t('setup.title')}
        subtitle={t('setup.intro')}
        backTo={user ? '/me' : '/'}
      />

      <div className="space-y-5">
        <RadioCards<TextSize>
          name="textSize"
          label={t('setup.textSize')}
          value={settings.textSize}
          onChange={(value) => updateSettings({ textSize: value }, { remote: false })}
          options={[
            { value: 'normal', label: t('setup.normal'), description: 'Aa' },
            { value: 'large', label: t('setup.large'), description: 'Aa' },
            { value: 'xl', label: t('setup.xl'), description: 'Aa' },
          ]}
          columns={3}
        />

        <RadioCards<Theme>
          name="theme"
          label={t('setup.theme')}
          value={settings.theme}
          onChange={(value) => updateSettings({ theme: value }, { remote: false })}
          options={[
            { value: 'light', label: t('setup.light'), icon: <Icon name="sun" /> },
            { value: 'inverted', label: t('setup.inverted'), icon: <Icon name="moon" /> },
          ]}
          columns={2}
        />

        <RadioCards<'slow' | 'normal' | 'fast'>
          name="voiceSpeed"
          label={t('setup.voiceSpeed')}
          value={settings.voiceSpeed < 0.8 ? 'slow' : settings.voiceSpeed > 1.02 ? 'fast' : 'normal'}
          onChange={(value) =>
            updateSettings({ voiceSpeed: value === 'slow' ? 0.7 : value === 'fast' ? 1.15 : 0.9 }, { remote: false })
          }
          options={[
            { value: 'slow', label: t('setup.slow') },
            { value: 'normal', label: t('setup.normalSpeed') },
            { value: 'fast', label: t('setup.fast') },
          ]}
          columns={3}
        />

        <div className="card">
          <p className="eyebrow mb-2">{t('setup.preview')}</p>
          <p className="text-xl font-bold">{t('welcome.title')}</p>
          <p className="mt-2">{t('setup.preview')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <SpeakButton text={t('setup.preview')} />
            <span className="chip">{t('voice.speed')}: {settings.voiceSpeed.toFixed(2)}×</span>
          </div>
        </div>

        <Toggle
          label={t('setup.autoRead')}
          checked={settings.autoRead}
          onChange={(value) => updateSettings({ autoRead: value }, { remote: false })}
        />
        <Toggle
          label={t('setup.reduceMotion')}
          checked={settings.reduceMotion}
          onChange={(value) => updateSettings({ reduceMotion: value }, { remote: false })}
        />

        {saved ? (
          <Notice variant="success" title={t('common.saved')} />
        ) : null}
        {error ? <Notice variant="error" title={t('common.error')}>{error}</Notice> : null}

        <Button size="lg" block loading={saving} onClick={() => void finish()} icon={<Icon name="check" />}>
          {user ? t('setup.finish') : t('action.continue')}
        </Button>
      </div>
    </div>
  );
}
