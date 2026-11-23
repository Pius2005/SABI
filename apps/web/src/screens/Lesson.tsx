import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { LessonDetail, PathDetail } from '@sabi/shared';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { useSettings } from '../lib/settings';
import { apiFetch, ApiError } from '../lib/api';
import { pushProgress } from '../lib/offline';
import { getBundle, loadProgress } from '../lib/storage';
import { errorMessage } from '../lib/format';
import { taskForKey, type PracticeTask } from '../lib/sandboxTasks';
import { useAsync } from '../lib/useAsync';
import { StepVisual } from '../components/StepVisual';
import { Sandbox } from '../components/Sandbox';
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
  ProgressBar,
} from '../components/ui';

type Phase = 'steps' | 'selfCheck' | 'done';

interface LessonData {
  lesson: LessonDetail;
  path: PathDetail | null;
  offline: boolean;
}

function practiceFor(lesson: LessonDetail, stepIndex: number): PracticeTask | null {
  const practice = lesson.steps[stepIndex]?.practice;
  if (!practice) return null;
  const known = taskForKey(practice.instructionKey);
  if (known) return known;
  return {
    id: practice.instructionKey,
    app: practice.app,
    target: practice.target,
    instructionKey: practice.instructionKey,
    instruction: practice.instruction,
    hint: 'Look at the glowing picture and follow the words.',
  };
}

export default function Lesson() {
  const { slug = '' } = useParams();
  const { user } = useAuth();
  const { lang, t, tf } = useI18n();
  const { settings } = useSettings();
  const navigate = useNavigate();

  const [stepIndex, setStepIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('steps');
  const [stuckOpen, setStuckOpen] = useState(false);
  const [pictureAgain, setPictureAgain] = useState(false);
  const [practiceDone, setPracticeDone] = useState(false);
  const [initialised, setInitialised] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef<string>('');

  const { data, error, loading, reload } = useAsync<LessonData>(async () => {
    try {
      const response = await apiFetch<{ lesson: LessonDetail }>(
        `/lessons/${encodeURIComponent(slug)}?lang=${encodeURIComponent(lang)}`,
      );
      let path: PathDetail | null = null;
      try {
        const pathResponse = await apiFetch<{ path: PathDetail }>(
          `/paths/${encodeURIComponent(response.lesson.pathSlug)}?lang=${encodeURIComponent(lang)}`,
        );
        path = pathResponse.path;
      } catch {
        path = null;
      }
      return { lesson: response.lesson, path, offline: false };
    } catch (caught) {
      if (!(caught instanceof ApiError) || caught.code !== 'NETWORK') throw caught;
      const bundle = getBundle(lang, slug);
      if (!bundle) throw caught;
      return { lesson: bundle.lesson, path: bundle.path, offline: true };
    }
  }, [slug, lang]);

  const lesson = data?.lesson ?? null;

  useEffect(() => {
    if (!lesson || !user || initialised) return;
    const row = loadProgress(user.id)[lesson.slug];
    const start = Math.min(row?.stepIndex ?? 0, Math.max(0, lesson.steps.length - 1));
    setStepIndex(start);
    setInitialised(true);
  }, [lesson, user, initialised]);

  useEffect(() => {
    setInitialised(false);
    setPhase('steps');
    setStepIndex(0);
    setPracticeDone(false);
    setStuckOpen(false);
  }, [slug, lang]);

  const currentStep = lesson?.steps[stepIndex] ?? null;
  const lastStep = lesson ? lesson.steps.length - 1 : 0;

  useEffect(() => {
    if (!lesson || !user || !initialised || phase !== 'steps') return;
    const key = `${lesson.slug}:${stepIndex}`;
    if (savedRef.current === key) return;
    savedRef.current = key;
    void pushProgress(user.id, lesson.slug, { stepIndex });
  }, [lesson, user, initialised, phase, stepIndex]);

  if (!user) return <Navigate to="/auth" replace />;
  if (loading && !data) return <LoadingPage />;
  if (error) return <ErrorState message={errorMessage(error, t)} onRetry={reload} />;
  if (!lesson) return <LoadingPage />;

  const practice = phase === 'steps' ? practiceFor(lesson, stepIndex) : null;
  const nextLesson = nextInPath(data?.path ?? null, lesson.slug);
  const isLastStep = stepIndex >= lastStep;

  const goNext = () => {
    setPictureAgain(false);
    if (!isLastStep) {
      setStepIndex((index) => Math.min(lastStep, index + 1));
      return;
    }
    setPhase('selfCheck');
  };

  const goBack = () => {
    setPictureAgain(false);
    if (phase === 'selfCheck') {
      setPhase('steps');
      return;
    }
    if (phase === 'done') {
      setPhase('selfCheck');
      return;
    }
    if (stepIndex === 0) {
      navigate(`/paths/${lesson.pathSlug}`);
      return;
    }
    setStepIndex((index) => Math.max(0, index - 1));
  };

  const notYet = () => {
    setPhase('steps');
    setStepIndex(Math.max(0, lastStep - 1));
    void pushProgress(user.id, lesson.slug, { stepIndex: Math.max(0, lastStep - 1) });
  };

  const finish = async () => {
    setSaving(true);
    setPhase('done');
    try {
      await pushProgress(user.id, lesson.slug, { stepIndex: lastStep, completed: true });
    } finally {
      setSaving(false);
    }
  };

  const reportStuck = () => {
    void pushProgress(user.id, lesson.slug, { stepIndex, stuck: true });
    setStuckOpen(true);
  };

  return (
    <div className="pb-6">
      <PageHeader
        title={lesson.title}
        subtitle={tf('common.minutes', { count: lesson.minutes })}
        backTo={`/paths/${lesson.pathSlug}`}
        actions={
          <Button variant="secondary" size="sm" onClick={reportStuck} icon={<Icon name="help" />}>
            {t('action.imStuck')}
          </Button>
        }
      />

      {data?.offline ? (
        <Notice variant="warning" title={t('common.offline')} className="mb-4">
          {t('home.offlineNotice')}
        </Notice>
      ) : null}

      {lesson.fallback && lang !== 'en' ? (
        <Notice variant="info" title={t('translation.reviewNeeded')} className="mb-4">
          {t('path.fallbackNotice')}
        </Notice>
      ) : null}

      {phase === 'steps' && currentStep ? (
        <div>
          <div className="mb-4">
            <ProgressBar
              value={((stepIndex + 1) / lesson.steps.length) * 100}
              label={tf('lesson.step', { current: stepIndex + 1, total: lesson.steps.length })}
            />
          </div>

          <Card className="mb-4">
            <div className="rounded-xl border-2 bg-paper p-2">
              <StepVisual
                name={currentStep.visual}
                alt={currentStep.alt || currentStep.text}
                spotlight={currentStep.spotlight}
              />
            </div>
            <p className="mt-4 text-2xl font-bold leading-snug" aria-live="polite">
              {currentStep.text}
            </p>
            {currentStep.alt ? <p className="mt-2 text-sm muted">{currentStep.alt}</p> : null}
            {pictureAgain ? (
              <Notice variant="info" className="mt-3">
                <p className="font-bold">{currentStep.alt || currentStep.text}</p>
                <p className="mt-1 text-sm">{t('sandbox.hint')}</p>
              </Notice>
            ) : null}
          </Card>

          {practice ? (
            <div className="mb-4">
              <Sandbox
                task={practice}
                onSuccess={() => {
                  setPracticeDone(true);
                  void pushProgress(user.id, lesson.slug, { stepIndex });
                }}
              />
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button variant="secondary" onClick={goBack} icon={<Icon name="back" />}>
              {t('action.back')}
            </Button>
            <Button size="lg" onClick={goNext} iconRight={<Icon name="forward" />}>
              {isLastStep ? t('lesson.selfCheck') : t('action.next')}
            </Button>
          </div>
        </div>
      ) : null}

      {phase === 'selfCheck' ? (
        <Card>
          <p className="eyebrow mb-2">{t('lesson.selfCheck')}</p>
          <p className="text-2xl font-bold leading-snug">{lesson.selfCheck}</p>
          {practiceDone ? (
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-bold">
              <Icon name="check-circle" size={18} />
              {t('sandbox.success')}
            </p>
          ) : null}
          <div className="mt-6 space-y-3">
            <Button
              size="lg"
              block
              loading={saving}
              onClick={() => void finish()}
              icon={<Icon name="check" />}
            >
              {t('lesson.didIt')}
            </Button>
            <Button variant="secondary" block onClick={notYet} icon={<Icon name="refresh" />}>
              {t('lesson.notYet')}
            </Button>
            <Button variant="ghost" block onClick={goBack} icon={<Icon name="back" />}>
              {t('action.back')}
            </Button>
          </div>
        </Card>
      ) : null}

      {phase === 'done' ? (
        <div>
          <Card className="text-center">
            <span className="mx-auto mb-3 inline-flex h-20 w-20 items-center justify-center rounded-full border-4">
              <Icon name="award" size={40} />
            </span>
            <h2 className="text-3xl font-bold">{t('lesson.congrats')}</h2>
            <p className="mt-2 muted">{lesson.title}</p>
            <div className="mt-5 space-y-3">
              {nextLesson ? (
                <LinkButton
                  to={`/lessons/${nextLesson.slug}`}
                  size="lg"
                  block
                  icon={<Icon name="play" />}
                >
                  {t('lesson.nextLesson')}
                </LinkButton>
              ) : null}
              <LinkButton
                to={`/paths/${lesson.pathSlug}`}
                variant="secondary"
                block
                icon={<Icon name="book" />}
              >
                {t('lesson.backToPath')}
              </LinkButton>
              <LinkButton to="/progress" variant="ghost" block icon={<Icon name="chart" />}>
                {t('progress.title')}
              </LinkButton>
            </div>
          </Card>
        </div>
      ) : null}

      <Dialog
        open={stuckOpen}
        onClose={() => setStuckOpen(false)}
        title={t('lesson.stuckTitle')}
        actions={
          <Button variant="secondary" onClick={() => setStuckOpen(false)}>
            {t('action.close')}
          </Button>
        }
      >
        <div className="space-y-3">
          <Button
            block
            variant="secondary"
            icon={<Icon name="eye" />}
            onClick={() => {
              setStuckOpen(false);
              setPhase('steps');
              setPictureAgain(true);
            }}
          >
            {t('lesson.stuckPicture')}
          </Button>
          <Button
            block
            variant="secondary"
            icon={<Icon name="edit" />}
            onClick={() => {
              setStuckOpen(false);
              navigate('/ask', {
                state: {
                  context: `${lesson.title}. ${currentStep?.text ?? ''}`.trim(),
                },
              });
            }}
          >
            {t('lesson.stuckAsk')}
          </Button>
          <Button
            block
            icon={<Icon name="users" />}
            onClick={() => {
              setStuckOpen(false);
              navigate('/help', { state: { context: { lessonSlug: lesson.slug, stepIndex } } });
            }}
          >
            {t('lesson.stuckPerson')}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function nextInPath(path: PathDetail | null, slug: string): PathDetail['lessons'][number] | null {
  if (!path) return null;
  const index = path.lessons.findIndex((lesson) => lesson.slug === slug);
  if (index === -1) return null;
  return path.lessons[index + 1] ?? null;
}
