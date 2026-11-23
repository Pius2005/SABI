import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { errorMessage, formatDate, relativeTime } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Icon } from '../components/Icon';
import {
  Button,
  Card,
  ErrorState,
  LoadingPage,
  Notice,
  PageHeader,
  SectionTitle,
} from '../components/ui';

interface GroupRow {
  id: string;
  name: string;
  venue: string | null;
  schedule: string | null;
  facilitatorId: string;
  notes: string;
  memberCount: number;
}

interface TriageRow {
  route: 'facilitator' | 'family' | 'support';
  priority: 'now' | 'soon' | 'whenever';
  source: 'drex' | 'local';
}

interface HelpRow {
  id: string;
  userId: string;
  learnerName?: string;
  type: 'call_back' | 'whatsapp' | 'facilitator';
  context: Record<string, unknown> | null;
  status: 'open' | 'contacted' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
  triage?: TriageRow | null;
}

interface LearnerRow {
  learnerId: string;
  name: string;
  lang: string;
  lessonsCompleted: number;
  lessonsStarted: number;
  stuckCount: number;
  lastActive: string | null;
  helpOpen: number;
}

export default function Facilitator() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState('');
  const [newVenue, setNewVenue] = useState('');
  const [newSchedule, setNewSchedule] = useState('');

  const [learnerName, setLearnerName] = useState('');
  const [learnerPhone, setLearnerPhone] = useState('');
  const [csv, setCsv] = useState('');
  const [notes, setNotes] = useState<string | null>(null);

  const { data, error: loadError, loading, reload } = useAsync<{
    groups: GroupRow[];
    requests: HelpRow[];
    learners: LearnerRow[];
    group: GroupRow | null;
  }>(async () => {
    const [groupsResponse, helpResponse] = await Promise.all([
      apiFetch<{ groups: GroupRow[] }>('/groups'),
      apiFetch<{ requests: HelpRow[] }>('/help-requests').catch(() => ({ requests: [] as HelpRow[] })),
    ]);
    const groups = groupsResponse.groups;
    const active = groups.find((group) => group.id === selectedId) ?? groups[0] ?? null;
    let learners: LearnerRow[] = [];
    if (active) {
      try {
        const response = await apiFetch<{ learners: LearnerRow[] }>(
          `/groups/${encodeURIComponent(active.id)}/progress`,
        );
        learners = response.learners;
      } catch {
        learners = [];
      }
    }
    return { groups, requests: helpResponse.requests, learners, group: active };
  }, [selectedId]);

  if (!user) return <Navigate to="/auth" replace />;
  if (loading && !data) return <LoadingPage />;
  if (loadError) return <ErrorState message={errorMessage(loadError, t)} onRetry={reload} />;
  if (!data) return <LoadingPage />;

  const run = async (task: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await task();
      setMessage(success);
      reload();
    } catch (caught) {
      setError(errorMessage(caught, t));
    } finally {
      setBusy(false);
    }
  };

  const createGroup = () =>
    run(
      () =>
        apiFetch('/groups', {
          method: 'POST',
          body: { name: newName.trim(), venue: newVenue.trim() || undefined, schedule: newSchedule.trim() || undefined },
        }),
      t('facilitator.create'),
    ).then(() => {
      setNewName('');
      setNewVenue('');
      setNewSchedule('');
    });

  const addLearner = () => {
    if (!data.group) return;
    return run(
      () =>
        apiFetch(`/groups/${encodeURIComponent(data.group!.id)}/members`, {
          method: 'POST',
          body: { name: learnerName.trim(), phone: learnerPhone.trim() },
        }),
      t('facilitator.addLearner'),
    ).then(() => {
      setLearnerName('');
      setLearnerPhone('');
    });
  };

  const importCsv = () => {
    if (!data.group) return;
    return run(
      () =>
        apiFetch(`/groups/${encodeURIComponent(data.group!.id)}/import`, {
          method: 'POST',
          body: { csv },
        }),
      t('facilitator.importCsv'),
    );
  };

  const saveNotes = () => {
    if (!data.group) return;
    return run(
      () =>
        apiFetch(`/groups/${encodeURIComponent(data.group!.id)}/notes`, {
          method: 'POST',
          body: { notes: notes ?? data.group!.notes },
        }),
      t('facilitator.saveNotes'),
    );
  };

  const updateHelp = (id: string, status: HelpRow['status']) =>
    run(
      () => apiFetch(`/help-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } }),
      t(`help.status.${status}`),
    );

  const openHelp = data.requests.filter((request) => request.status !== 'resolved');
  const group = data.group;

  return (
    <div className="pb-6">
      <PageHeader
        title={t('facilitator.title')}
        subtitle={`${data.groups.length} ${t('facilitator.groups')}`}
        backTo="/home"
        actions={
          <Button variant="secondary" size="sm" onClick={() => window.print()} icon={<Icon name="printer" size={16} />}>
            {t('facilitator.print')}
          </Button>
        }
      />

      {error ? (
        <Notice variant="error" title={t('common.error')} className="mb-4">
          {error}
        </Notice>
      ) : null}
      {message ? (
        <Notice variant="success" className="mb-4">
          {message}
        </Notice>
      ) : null}

      <SectionTitle>{t('facilitator.needsHelp')}</SectionTitle>
      {openHelp.length === 0 ? (
        <Card>
          <p className="font-bold">{t('help.none')}</p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {openHelp.map((request) => (
            <li key={request.id} className="rounded-xl2 border-2 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold">{request.learnerName ?? 'Learner'}</p>
                  <p className="text-sm muted">
                    {t(`help.${request.type === 'call_back' ? 'callback' : request.type}`)} ·{' '}
                    {formatDate(request.createdAt)} · {relativeTime(request.createdAt)}
                  </p>
                </div>
                <span className="chip">
                  <Icon name="clock" size={14} />
                  {t(`help.status.${request.status}`)}
                </span>
              </div>
              {request.triage ? (
                <p className="mt-2 flex flex-wrap items-center gap-1 text-sm">
                  <span className={`chip ${request.triage.priority === 'now' ? 'chip-solid' : ''}`}>
                    {t(`triage.priority.${request.triage.priority}`)}
                  </span>
                  <span className="chip">{t(`triage.route.${request.triage.route}`)}</span>
                  <span className="muted text-xs">
                    {request.triage.source === 'drex' ? t('triage.byDrex') : t('triage.byLocal')}
                  </span>
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void updateHelp(request.id, 'contacted')}
                >
                  {t('help.contact')}
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void updateHelp(request.id, 'resolved')} icon={<Icon name="check" size={16} />}>
                  {t('help.resolve')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SectionTitle>{t('facilitator.groups')}</SectionTitle>
      {data.groups.length === 0 ? (
        <Card className="mb-4">
          <p className="font-bold">{t('facilitator.noGroups')}</p>
        </Card>
      ) : (
        <div className="mb-4 flex flex-wrap gap-2">
          {data.groups.map((row) => (
            <button
              key={row.id}
              type="button"
              aria-pressed={row.id === group?.id}
              onClick={() => {
                setSelectedId(row.id);
                setNotes(null);
              }}
              className={`chip ${row.id === group?.id ? 'chip-solid' : ''}`}
            >
              <Icon name="users" size={14} />
              {row.name} ({row.memberCount})
            </button>
          ))}
        </div>
      )}

      {group ? (
        <>
          <Card className="mb-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-2xl font-bold">{group.name}</h2>
                <p className="text-sm muted">
                  {group.venue ?? '—'} · {group.schedule ?? '—'}
                </p>
              </div>
              <span className="chip">
                <Icon name="users" size={14} />
                {group.memberCount}
              </span>
            </div>
          </Card>

          <SectionTitle>{t('facilitator.learners')}</SectionTitle>
          {data.learners.length === 0 ? (
            <Card className="mb-4">
              <p className="font-bold">{t('facilitator.noGroups')}</p>
              <p className="mt-1 text-sm muted">{t('facilitator.addLearner')}</p>
            </Card>
          ) : (
            <div className="table-wrap mb-4">
              <table>
                <thead>
                  <tr>
                    <th scope="col">{t('common.name')}</th>
                    <th scope="col">{t('common.lessons')}</th>
                    <th scope="col">{t('action.imStuck')}</th>
                    <th scope="col">{t('common.progress')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.learners.map((learner) => (
                    <tr key={learner.learnerId}>
                      <td>
                        <span className="font-bold">{learner.name}</span>
                        <span className="block text-xs muted">{learner.lang.toUpperCase()}</span>
                      </td>
                      <td>
                        {learner.lessonsCompleted} / {learner.lessonsStarted}
                      </td>
                      <td>{learner.stuckCount}</td>
                      <td>{learner.lastActive ? relativeTime(learner.lastActive) : t('common.notStarted')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <h3 className="font-bold">{t('facilitator.addLearner')}</h3>
              <div className="mt-3 space-y-2">
                <label className="label" htmlFor="learner-name">
                  {t('common.name')}
                </label>
                <input
                  id="learner-name"
                  className="input"
                  value={learnerName}
                  maxLength={60}
                  onChange={(event) => setLearnerName(event.target.value)}
                />
                <label className="label" htmlFor="learner-phone">
                  {t('common.phone')}
                </label>
                <input
                  id="learner-phone"
                  className="input"
                  type="tel"
                  inputMode="tel"
                  placeholder="0803 000 0000"
                  value={learnerPhone}
                  onChange={(event) => setLearnerPhone(event.target.value)}
                />
                <Button
                  block
                  loading={busy}
                  disabled={!learnerName.trim() || learnerPhone.trim().length < 7}
                  onClick={() => void addLearner()}
                  icon={<Icon name="plus" />}
                >
                  {t('action.add')}
                </Button>
              </div>
            </Card>

            <Card>
              <h3 className="font-bold">{t('facilitator.importCsv')}</h3>
              <p className="mt-1 text-sm muted">{t('facilitator.csvHint')}</p>
              <label className="label mt-2" htmlFor="csv">
                name,phone
              </label>
              <textarea
                id="csv"
                className="textarea"
                value={csv}
                placeholder={'Ada Okafor,08030000001\nMusa Bello,08030000002'}
                onChange={(event) => setCsv(event.target.value)}
              />
              <Button
                className="mt-2"
                block
                variant="secondary"
                loading={busy}
                disabled={csv.trim().length < 3}
                onClick={() => void importCsv()}
                icon={<Icon name="import" />}
              >
                {t('action.import')}
              </Button>
            </Card>
          </div>

          <SectionTitle>{t('facilitator.notes')}</SectionTitle>
          <Card>
            <label className="label" htmlFor="group-notes">
              {t('facilitator.notes')}
            </label>
            <textarea
              id="group-notes"
              className="textarea"
              value={notes ?? group.notes}
              maxLength={4000}
              onChange={(event) => setNotes(event.target.value)}
            />
            <Button
              className="mt-2"
              loading={busy}
              onClick={() => void saveNotes()}
              icon={<Icon name="check" />}
            >
              {t('facilitator.saveNotes')}
            </Button>
          </Card>
        </>
      ) : null}

      <SectionTitle>{t('facilitator.newGroup')}</SectionTitle>
      <Card>
        <div className="space-y-2">
          <label className="label" htmlFor="group-name">
            {t('facilitator.groupName')}
          </label>
          <input
            id="group-name"
            className="input"
            value={newName}
            maxLength={80}
            onChange={(event) => setNewName(event.target.value)}
          />
          <label className="label" htmlFor="group-venue">
            {t('facilitator.venue')}
          </label>
          <input
            id="group-venue"
            className="input"
            value={newVenue}
            maxLength={80}
            onChange={(event) => setNewVenue(event.target.value)}
          />
          <label className="label" htmlFor="group-schedule">
            {t('facilitator.schedule')}
          </label>
          <input
            id="group-schedule"
            className="input"
            value={newSchedule}
            maxLength={80}
            onChange={(event) => setNewSchedule(event.target.value)}
          />
          <Button
            block
            loading={busy}
            disabled={newName.trim().length < 2}
            onClick={() => void createGroup()}
            icon={<Icon name="plus" />}
          >
            {t('facilitator.create')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
