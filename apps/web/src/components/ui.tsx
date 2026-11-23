import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  block = false,
  extra = '',
): string {
  return [
    'btn',
    `btn-${variant}`,
    size === 'lg' ? 'btn-lg' : size === 'sm' ? 'btn-sm' : '',
    block ? 'btn-block' : '',
    extra,
  ]
    .filter(Boolean)
    .join(' ');
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  icon,
  iconRight,
  loading,
  children,
  className = '',
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={buttonClass(variant, size, block, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={size === 'sm' ? 18 : 22} /> : icon}
      {children ? <span>{children}</span> : null}
      {iconRight}
    </button>
  );
}

export interface LinkButtonProps {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
  className?: string;
  state?: unknown;
}

export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  block,
  icon,
  iconRight,
  children,
  className = '',
  state,
}: LinkButtonProps) {
  return (
    <Link to={to} state={state} className={buttonClass(variant, size, block, className)}>
      {icon}
      <span>{children}</span>
      {iconRight}
    </Link>
  );
}

export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}) {
  return <Tag className={`card ${className}`}>{children}</Tag>;
}

export type NoticeVariant = 'info' | 'warning' | 'error' | 'success';

const NOTICE_ICON: Record<NoticeVariant, IconName> = {
  info: 'info',
  warning: 'alert',
  error: 'alert',
  success: 'check-circle',
};

export function Notice({
  variant = 'info',
  title,
  children,
  className = '',
  action,
}: {
  variant?: NoticeVariant;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={`rounded-xl2 border-2 p-4 ${
        variant === 'warning' || variant === 'error' ? 'border-dashed' : ''
      } ${className}`}
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex items-start gap-3">
        <Icon name={NOTICE_ICON[variant]} size={26} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          {title ? <p className="font-bold">{title}</p> : null}
          {children ? <div className={title ? 'mt-1' : ''}>{children}</div> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  backTo,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  backTo?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="mb-5">
      <div className="mb-2 flex min-h-[3rem] items-center justify-between gap-2">
        {backTo ? (
          <Link to={backTo} className="btn btn-ghost btn-sm -ml-2">
            <Icon name="back" size={22} />
            <span>{t('action.back')}</span>
          </Link>
        ) : (
          <span />
        )}
        {actions}
      </div>
      {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
      {subtitle ? <div className="mt-2 text-lg muted">{subtitle}</div> : null}
    </div>
  );
}

export function SectionTitle({
  children,
  id,
  action,
}: {
  children: ReactNode;
  id?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 mt-7 flex items-end justify-between gap-3">
      <h2 id={id} className="text-2xl font-bold leading-tight">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Spinner({ size = 24, label }: { size?: number; label?: string }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-[0.2rem] border-current border-t-transparent"
      style={{ width: size, height: size }}
      role="status"
      aria-label={label ?? 'Loading'}
    />
  );
}

export function LoadingPage({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <Spinner size={44} label={label ?? t('common.loading')} />
      <p className="text-lg font-bold">{label ?? t('common.loading')}</p>
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  return (
    <Notice
      variant="error"
      title={t('common.error')}
      action={
        onRetry ? (
          <Button variant="secondary" onClick={onRetry} icon={<Icon name="refresh" />}>
            {t('action.retry')}
          </Button>
        ) : undefined
      }
    >
      <p>{message}</p>
    </Notice>
  );
}

export function EmptyState({
  icon = 'info',
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl2 border-2 border-dashed p-6 text-center">
      <Icon name={icon} size={44} className="mx-auto mb-3" />
      <p className="text-xl font-bold">{title}</p>
      {children ? <div className="mt-2 muted">{children}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-xl2 border-2 p-4 text-left disabled:opacity-50"
    >
      <span className="min-w-0">
        <span className="block font-bold">{label}</span>
        {description ? <span className="mt-1 block text-sm muted">{description}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-flex h-9 w-16 shrink-0 items-center rounded-full border-2 ${
          checked ? 'bg-ink' : 'bg-paper'
        }`}
      >
        <span
          className={`inline-block h-7 w-7 rounded-full border-2 transition-transform ${
            checked ? 'translate-x-[1.85rem] border-paper bg-paper' : 'translate-x-0.5 border-ink bg-ink'
          }`}
        />
      </span>
    </button>
  );
}

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export function RadioCards<T extends string>({
  name,
  label,
  value,
  onChange,
  options,
  columns = 1,
}: {
  name: string;
  label: string;
  value: T;
  onChange: (next: T) => void;
  options: Array<RadioOption<T>>;
  columns?: 1 | 2 | 3;
}) {
  return (
    <fieldset>
      <legend className="mb-2 font-bold">{label}</legend>
      <div
        className={`grid gap-3 ${
          columns === 2 ? 'sm:grid-cols-2' : columns === 3 ? 'grid-cols-3' : ''
        }`}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl2 border-2 p-4 transition-colors ${
                selected ? 'bg-ink text-paper' : 'bg-paper text-ink'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className={`mt-1 h-5 w-5 shrink-0 ${selected ? 'accent-paper' : 'accent-ink'}`}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-bold">
                  {option.icon}
                  {option.label}
                </span>
                {option.description ? (
                  <span className={`mt-1 block text-sm ${selected ? '' : 'muted'}`}>{option.description}</span>
                ) : null}
              </span>
              {selected ? <Icon name="check" size={22} className="mt-0.5 shrink-0" /> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ProgressBar({
  value,
  label,
  showValue = true,
}: {
  value: number;
  label: string;
  showValue?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-sm font-bold">
        <span>{label}</span>
        {showValue ? <span>{clamped}%</span> : null}
      </div>
      <div
        className="h-4 w-full overflow-hidden rounded-full border-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={label}
      >
        <div className="h-full bg-ink transition-[width]" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

export function Dialog({
  open,
  title,
  children,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = window.setTimeout(() => ref.current?.focus(), 20);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sabi-dialog-title"
        tabIndex={-1}
        className="w-full max-w-lg rounded-xl2 border-4 bg-paper p-6 text-ink"
        style={{ borderColor: 'rgb(var(--ink))' }}
      >
        <h2 id="sabi-dialog-title" className="text-2xl font-bold">
          {title}
        </h2>
        {children ? <div className="mt-3">{children}</div> : null}
        {actions ? <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{actions}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function StatusPill({ status }: { status: string }) {
  const label =
    status === 'approved'
      ? 'Approved'
      : status === 'needs_review'
        ? 'Needs review'
        : status === 'machine'
          ? 'Machine'
          : status === 'draft'
            ? 'Draft'
            : 'Missing';
  return (
    <span className={`chip ${status === 'approved' ? 'chip-solid' : ''}`}>
      <Icon name={status === 'approved' ? 'check' : status === 'missing' ? 'alert' : 'edit'} size={14} />
      {label}
    </span>
  );
}

export function IconBadge({ name, size = 28 }: { name: IconName; size?: number }) {
  return (
    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2">
      <Icon name={name} size={size} />
    </span>
  );
}
