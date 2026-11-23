import { Navigate } from 'react-router-dom';
import { IS_DEV } from '../lib/config';
import { useI18n } from '../lib/i18n';
import { useSettings } from '../lib/settings';
import { Icon } from '../components/Icon';
import { Button, Card, PageHeader, ProgressBar, StatusPill, Toggle } from '../components/ui';
import { useState } from 'react';

export default function DevTypography() {
  const { t } = useI18n();
  const { settings, updateSettings } = useSettings();
  const [toggle, setToggle] = useState(true);

  if (!IS_DEV) return <Navigate to="/" replace />;

  return (
    <div className="pb-6">
      <PageHeader title={t('dev.typography')} subtitle="Developer reference. Not shown in production." backTo="/me" />

      <Card className="mb-4">
        <p className="eyebrow mb-2">Type scale</p>
        <p className="text-4xl font-bold">Heading 1</p>
        <p className="text-3xl font-bold">Heading 2</p>
        <p className="text-2xl font-bold">Heading 3</p>
        <p className="text-xl font-bold">Heading 4</p>
        <p className="mt-2 text-lg">Large body text for older readers.</p>
        <p className="mt-1">Normal body text with <strong>bold</strong> and <em>emphasis</em>.</p>
        <p className="mt-1 text-sm muted">Small muted helper text.</p>
      </Card>

      <Card className="mb-4">
        <p className="eyebrow mb-2">Buttons</p>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Icon name="check" />}>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </Card>

      <Card className="mb-4">
        <p className="eyebrow mb-2">Status and progress</p>
        <div className="flex flex-wrap gap-2">
          <StatusPill status="approved" />
          <StatusPill status="needs_review" />
          <StatusPill status="machine" />
          <StatusPill status="draft" />
          <StatusPill status="missing" />
        </div>
        <div className="mt-3">
          <ProgressBar value={62} label="Progress" />
        </div>
      </Card>

      <Card className="mb-4">
        <p className="eyebrow mb-2">Settings</p>
        <Toggle label="Sample toggle" checked={toggle} onChange={setToggle} />
        <p className="mt-2 text-sm muted">
          Text: {settings.textSize} · Theme: {settings.theme}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => updateSettings({ textSize: 'normal' }, { remote: false })}>
            Normal
          </Button>
          <Button variant="secondary" size="sm" onClick={() => updateSettings({ textSize: 'large' }, { remote: false })}>
            Large
          </Button>
          <Button variant="secondary" size="sm" onClick={() => updateSettings({ textSize: 'xl' }, { remote: false })}>
            Extra large
          </Button>
        </div>
      </Card>

      <Card>
        <p className="eyebrow mb-2">Icons</p>
        <div className="flex flex-wrap gap-3">
          {[
            'home',
            'book',
            'help',
            'user',
            'mic',
            'phone',
            'chat',
            'bank',
            'shield',
            'globe',
            'download',
            'check-circle',
            'alert',
            'heart',
            'award',
            'printer',
            'wifi',
            'wifi-off',
          ].map((name) => (
            <span key={name} className="flex h-12 w-12 items-center justify-center rounded-full border-2" title={name}>
              <Icon name={name} size={24} />
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
