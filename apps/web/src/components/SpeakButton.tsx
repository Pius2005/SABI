import { useI18n } from '../lib/i18n';
import { useSpeech } from '../lib/speech';
import { Button, type ButtonSize, type ButtonVariant } from './ui';
import { Icon } from './Icon';

export function SpeakButton({
  text,
  label,
  variant = 'secondary',
  size = 'md',
  slow = false,
  className,
}: {
  text: string;
  label?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  slow?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const { speak, speaking, stopSpeaking, synthesisSupported } = useSpeech();
  const actionLabel = label ?? t('action.listen');

  if (!text.trim()) return null;

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={!synthesisSupported}
      onClick={() => {
        if (speaking) stopSpeaking();
        else speak(text, { speed: slow ? 0.65 : undefined });
      }}
      icon={<Icon name={speaking ? 'stop' : 'volume'} />}
      aria-label={speaking ? t('action.stop') : actionLabel}
    >
      {speaking ? t('action.stop') : actionLabel}
    </Button>
  );
}
