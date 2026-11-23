import { useI18n } from '../lib/i18n';
import { APP_NAME } from '../lib/config';
import { Icon } from '../components/Icon';
import { LinkButton } from '../components/ui';

export default function NotFound() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center py-10 text-center">
      <span className="flex h-24 w-24 items-center justify-center rounded-full border-4">
        <Icon name="search" size={44} />
      </span>
      <p className="eyebrow mt-4">{APP_NAME}</p>
      <h1 className="mt-2 text-3xl font-bold">{t('errors.notFound')}</h1>
      <p className="mt-2 max-w-sm muted">
        The page you asked for is not here. Go back to the home page and try again.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <LinkButton to="/home" icon={<Icon name="home" />}>
          {t('nav.home')}
        </LinkButton>
        <LinkButton to="/help" variant="secondary" icon={<Icon name="help" />}>
          {t('nav.help')}
        </LinkButton>
      </div>
    </div>
  );
}
