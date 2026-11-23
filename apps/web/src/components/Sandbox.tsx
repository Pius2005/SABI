import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { PracticeTask } from '../lib/sandboxTasks';
import { Icon } from './Icon';
import { Button, Notice } from './ui';

type Status = 'idle' | 'success' | 'wrong';

interface SandboxProps {
  task: PracticeTask;
  onSuccess?: () => void;
  onFinish?: () => void;
}

function PhoneMock({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="mx-auto w-full max-w-[20rem]">
      <div className="rounded-[2rem] border-4 p-2" style={{ borderColor: 'rgb(var(--ink))' }}>
        <div className="flex min-h-[26rem] flex-col overflow-hidden rounded-[1.4rem] border-2">
          <div className="flex items-center justify-between border-b-2 px-3 py-2 text-xs font-bold">
            <span>9:41</span>
            <span aria-hidden="true">▮▮▮</span>
          </div>
          <div className="flex items-center gap-2 border-b-2 px-3 py-2">
            <Icon name="back" size={18} />
            <span className="font-bold">{title}</span>
          </div>
          <div className="flex flex-1 flex-col p-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function Sandbox({ task, onSuccess, onFinish }: SandboxProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('idle');
  const [showHint, setShowHint] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [chatOpen, setChatOpen] = useState(task.target !== 'chat-ada');
  const [holding, setHolding] = useState(false);
  const [holdMs, setHoldMs] = useState(0);
  const holdStart = useRef(0);
  const wrongReported = useRef(false);
  const successReported = useRef(false);

  useEffect(() => {
    setStatus('idle');
    setShowHint(false);
    setHintsUsed(0);
    setChatOpen(task.target !== 'chat-ada');
    setHolding(false);
    setHoldMs(0);
    wrongReported.current = false;
    successReported.current = false;
  }, [task.id, task.target]);

  useEffect(() => {
    if (!holding) return;
    const timer = window.setInterval(() => {
      setHoldMs(Math.min(2000, Date.now() - holdStart.current));
    }, 80);
    return () => window.clearInterval(timer);
  }, [holding]);

  const report = (success: boolean) => {
    void apiFetch('/sandbox/attempts', {
      method: 'POST',
      body: { taskId: task.id, success, hintsUsed },
    }).catch(() => undefined);
  };

  const correct = () => {
    if (status === 'success') return;
    setStatus('success');
    if (!successReported.current) {
      successReported.current = true;
      report(true);
    }
    onSuccess?.();
  };

  const wrong = () => {
    if (status === 'success') return;
    setStatus('wrong');
    if (!wrongReported.current) {
      wrongReported.current = true;
      report(false);
    }
  };

  const handleTarget = (target: string) => {
    if (target === task.target) correct();
    else wrong();
  };

  const startHold = () => {
    holdStart.current = Date.now();
    setHolding(true);
    setHoldMs(0);
  };

  const endHold = () => {
    if (!holding) return;
    const elapsed = Date.now() - holdStart.current;
    setHolding(false);
    setHoldMs(0);
    if (task.target === 'mic-hold' && elapsed >= 1800) correct();
    else wrong();
  };

  const openHint = () => {
    setShowHint(true);
    setHintsUsed((value) => value + 1);
  };

  const appTitle =
    task.app === 'dialer'
      ? 'Phone'
      : task.app === 'whatsapp'
        ? 'WhatsApp'
        : task.app === 'bank'
          ? 'My bank'
          : task.app === 'sms'
            ? 'Messages'
            : 'Practice';

  const renderApp = () => {
    if (task.app === 'dialer') {
      return (
        <PhoneMock title="Phone">
          <p className="text-center text-xl font-bold tracking-wider">0803 000 0000</p>
          <p className="mb-2 text-center text-xs muted">Practice number</p>
          <div className="mx-auto grid w-full max-w-[14rem] grid-cols-3 gap-2">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((key) => (
              <span
                key={key}
                className="flex min-h-[2.6rem] items-center justify-center rounded-full border-2 text-lg font-bold"
                aria-hidden="true"
              >
                {key}
              </span>
            ))}
          </div>
          <div className="mt-auto flex items-end justify-center gap-4 pt-4">
            <button
              type="button"
              onClick={() => handleTarget('ussd')}
              className="btn btn-secondary btn-sm"
              data-target="ussd"
            >
              *737#
            </button>
            <button
              type="button"
              onClick={() => handleTarget('call-button')}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 bg-ink text-paper"
              aria-label="Call button"
              data-target="call-button"
            >
              <Icon name="phone" size={28} />
            </button>
          </div>
        </PhoneMock>
      );
    }

    if (task.app === 'whatsapp') {
      if (!chatOpen) {
        return (
          <PhoneMock title="WhatsApp">
            <p className="mb-2 text-sm font-bold">Chats</p>
            <button
              type="button"
              onClick={() => {
                setChatOpen(true);
                handleTarget('chat-ada');
              }}
              className="flex w-full items-center gap-3 border-b-2 px-1 py-3 text-left"
              data-target="chat-ada"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold">A</span>
              <span>
                <span className="block font-bold">Ada</span>
                <span className="block text-xs muted">See you soon</span>
              </span>
            </button>
            <div className="flex items-center gap-3 px-1 py-3 opacity-60" aria-hidden="true">
              <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold">M</span>
              <span>
                <span className="block font-bold">Mama</span>
                <span className="block text-xs">Did you eat?</span>
              </span>
            </div>
          </PhoneMock>
        );
      }
      return (
        <PhoneMock title="Ada">
          <div className="space-y-2">
            <p className="w-fit max-w-[80%] rounded-xl border-2 px-3 py-2 text-sm">Good morning, how are you?</p>
            <p className="ml-auto w-fit max-w-[80%] rounded-xl bg-ink px-3 py-2 text-sm text-paper">
              I am fine. Thank you.
            </p>
            <p className="w-fit max-w-[80%] rounded-xl border-2 px-3 py-2 text-sm">See you soon</p>
          </div>
          <div className="mt-auto flex items-center gap-2 pt-4">
            <button
              type="button"
              onClick={() => handleTarget('attach')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2"
              aria-label="Attach a photo"
              data-target="attach"
            >
              <Icon name="paperclip" size={20} />
            </button>
            <span className="flex min-h-[2.75rem] flex-1 items-center rounded-full border-2 px-3 text-sm muted">
              Message
            </span>
            <button
              type="button"
              onPointerDown={startHold}
              onPointerUp={endHold}
              onPointerLeave={() => {
                if (holding) endHold();
              }}
              onKeyDown={(event) => {
                if ((event.key === ' ' || event.key === 'Enter') && !holding) {
                  event.preventDefault();
                  startHold();
                }
              }}
              onKeyUp={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  endHold();
                }
              }}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 ${
                holding ? 'bg-ink text-paper' : ''
              }`}
              aria-label="Hold the microphone for two seconds"
              data-target="mic-hold"
            >
              <Icon name="mic" size={20} />
            </button>
            <button
              type="button"
              onClick={() => handleTarget('send')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 bg-ink text-paper"
              aria-label="Send"
              data-target="send"
            >
              <Icon name="send" size={18} />
            </button>
          </div>
          {holding ? (
            <div className="mt-2">
              <div className="h-2 w-full overflow-hidden rounded-full border-2">
                <div className="h-full bg-ink" style={{ width: `${(holdMs / 2000) * 100}%` }} />
              </div>
              <p className="mt-1 text-center text-xs font-bold">Keep holding… lift after 2 seconds</p>
            </div>
          ) : null}
        </PhoneMock>
      );
    }

    if (task.app === 'bank') {
      return (
        <PhoneMock title="My bank">
          <div className="rounded-xl bg-ink p-3 text-paper">
            <p className="text-xs">Practice account</p>
            <p className="text-2xl font-bold">₦ 25,000</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTarget('balance')}
              className="btn btn-secondary"
              data-target="balance"
            >
              Balance
            </button>
            <button
              type="button"
              onClick={() => handleTarget('send-money')}
              className="btn btn-secondary"
              data-target="send-money"
            >
              Transfer
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 opacity-60" aria-hidden="true">
            <span className="btn btn-secondary">Airtime</span>
            <span className="btn btn-secondary">History</span>
          </div>
          <p className="mt-auto pt-4 text-center text-xs font-bold">
            No real money. This is a practice screen.
          </p>
        </PhoneMock>
      );
    }

    if (task.app === 'sms') {
      return (
        <PhoneMock title="Messages">
          <div className="rounded-xl border-2 border-dashed p-3">
            <p className="text-sm font-bold">Unknown sender</p>
            <p className="mt-2 text-sm">Send your OTP now or your account closes.</p>
            <p className="mt-2 text-sm underline">bank-check.example</p>
          </div>
          <div className="mt-auto flex gap-2 pt-4">
            <button
              type="button"
              onClick={() => handleTarget('block')}
              className="btn btn-primary flex-1"
              data-target="block"
            >
              Block
            </button>
            <button type="button" onClick={() => wrong()} className="btn btn-secondary flex-1">
              Delete
            </button>
          </div>
        </PhoneMock>
      );
    }

    return (
      <PhoneMock title={appTitle}>
        <p className="text-center text-sm">This practice screen is not needed for this lesson.</p>
      </PhoneMock>
    );
  };

  return (
    <section className="rounded-xl2 border-2 p-4" aria-labelledby="sandbox-task-heading">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="chip chip-solid">
          <Icon name="hand" size={15} />
          {t('sandbox.noReal')}
        </span>
        <span className="text-sm font-bold">{t('sandbox.title')}</span>
      </div>
      <h3 id="sandbox-task-heading" className="text-lg font-bold">
        {t('sandbox.task')}
      </h3>
      <p className="mb-3 text-lg">{task.instruction}</p>
      <Notice variant="info" className="mb-3">
        {t('sandbox.banner')}
      </Notice>

      {status === 'success' ? (
        <Notice variant="success" title={t('sandbox.success')} className="mb-3">
          {onFinish ? (
            <Button variant="secondary" onClick={onFinish} icon={<Icon name="check" />}>
              {t('sandbox.finish')}
            </Button>
          ) : null}
        </Notice>
      ) : null}

      {status === 'wrong' ? (
        <Notice variant="warning" title={t('action.tryAgain')} className="mb-3">
          <p>{t('sandbox.wrong')}</p>
        </Notice>
      ) : null}

      <div className={status === 'success' ? 'opacity-70' : ''}>{renderApp()}</div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={openHint} icon={<Icon name="help" />}>
          {t('sandbox.hint')}
        </Button>
        {status !== 'idle' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus('idle');
              setHolding(false);
              setHoldMs(0);
              setChatOpen(task.target !== 'chat-ada');
            }}
            icon={<Icon name="refresh" />}
          >
            {t('action.tryAgain')}
          </Button>
        ) : null}
      </div>
      {showHint ? (
        <p className="mt-2 rounded-xl border-2 border-dashed p-3 text-sm" role="status">
          {task.hint}
        </p>
      ) : null}
    </section>
  );
}
