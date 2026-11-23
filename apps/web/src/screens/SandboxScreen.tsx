import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import type { SandboxApp } from '@sabi/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { SANDBOX_APPS, tasksForApp } from '../lib/sandboxTasks';
import { Sandbox } from '../components/Sandbox';
import { Icon } from '../components/Icon';
import { Card, EmptyState, LinkButton, Notice, PageHeader } from '../components/ui';

export default function SandboxScreen() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [app, setApp] = useState<SandboxApp>('dialer');
  const [taskIndex, setTaskIndex] = useState(0);

  if (!user) return <Navigate to="/auth" replace />;

  const tasks = tasksForApp(app);
  const task = tasks[Math.min(taskIndex, Math.max(0, tasks.length - 1))] ?? null;

  return (
    <div className="pb-6">
      <PageHeader
        title={t('sandbox.title')}
        subtitle={t('sandbox.banner')}
        backTo="/home"
      />

      <Notice variant="warning" className="mb-4">
        {t('sandbox.noReal')}
      </Notice>

      <div className="mb-4 grid grid-cols-4 gap-2" role="tablist" aria-label={t('sandbox.title')}>
        {SANDBOX_APPS.map((entry) => {
          const active = entry.app === app;
          return (
            <button
              key={entry.app}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setApp(entry.app);
                setTaskIndex(0);
              }}
              className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl2 border-2 px-1 py-2 text-sm font-bold ${
                active ? 'bg-ink text-paper' : 'bg-paper text-ink'
              }`}
            >
              <Icon
                name={
                  entry.app === 'dialer'
                    ? 'phone'
                    : entry.app === 'whatsapp'
                      ? 'chat'
                      : entry.app === 'bank'
                        ? 'bank'
                        : 'message'
                }
                size={24}
              />
              {t(`app.${entry.app}`)}
            </button>
          );
        })}
      </div>

      {task ? (
        <>
          {tasks.length > 1 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {tasks.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTaskIndex(index)}
                  aria-pressed={index === taskIndex}
                  className={`chip ${index === taskIndex ? 'chip-solid' : ''}`}
                >
                  {index + 1}. {item.instruction}
                </button>
              ))}
            </div>
          ) : null}
          <Sandbox key={task.id} task={task} />
        </>
      ) : (
        <EmptyState icon="hand" title={t('sandbox.task')}>
          {t('sandbox.hint')}
        </EmptyState>
      )}

      <Card className="mt-5">
        <p className="font-bold">{t('lesson.sandbox')}</p>
        <p className="mt-1 text-sm muted">{t('sandbox.banner')}</p>
        <LinkButton to="/paths" variant="secondary" className="mt-3" icon={<Icon name="book" />}>
          {t('home.learn')}
        </LinkButton>
      </Card>
    </div>
  );
}
