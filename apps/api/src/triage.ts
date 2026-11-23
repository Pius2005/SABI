/**
 * Drex help-request triage.
 *
 * SABI sends one compact, non-identifying case state and two typed questions to
 * the Nace Drex decision API, then routes the help request on the calibrated
 * probability of each option. A learner never waits on the model: when no key is
 * configured, or Drex does not answer in time, the local rule set below routes
 * the request instead.
 *
 * Only a short summary leaves the API. Names, phone numbers, transcripts and
 * free-form context stay in SABI.
 *
 * Docs: https://console.nace.ai/docs/drex/quickstart
 */
import type { Env } from './env';

const DREX_URL = 'https://console.nace.ai/v1/systemone';
const DREX_MODEL = 'drex-latest';
const DREX_TIMEOUT_MS = 8_000;

/** Below this probability the top option is too close to the rest to act on. */
export const ROUTE_MIN_PROBABILITY = 0.5;
/** Above this probability Drex is saying a person must reach the learner today. */
export const URGENT_MIN_PROBABILITY = 0.6;

export const TRIAGE_ROUTES = ['facilitator', 'family', 'support'] as const;
export type TriageRoute = (typeof TRIAGE_ROUTES)[number];

export const TRIAGE_PRIORITIES = ['now', 'soon', 'whenever'] as const;
export type TriagePriority = (typeof TRIAGE_PRIORITIES)[number];

export interface TriageCase {
  requestType: 'call_back' | 'whatsapp' | 'facilitator';
  lang: string;
  context: Record<string, unknown> | null;
}

export interface TriageDecision {
  route: TriageRoute;
  priority: TriagePriority;
  urgent: boolean;
  /** `drex` when the API answered, `local` when the rule set did. */
  source: 'drex' | 'local';
  /** The pinned Drex version that answered, or null for a local decision. */
  model: string | null;
  /** Probability per route label, from the choice answer. */
  probabilities: Record<string, number>;
  requestId: string | null;
}

interface DrexChoiceAnswer {
  choice: string;
  probabilities: Record<string, number>;
}

interface DrexResponse {
  model?: string;
  answers?: Record<string, unknown>;
  request_id?: string;
}

const QUESTIONS = {
  urgent: {
    type: 'noul',
    instructions: 'Does this learner need a person to reach them today?',
  },
  route: {
    type: 'choice',
    instructions: 'Who should handle this help request first?',
    criteria: {
      facilitator: 'A SABI facilitator who teaches the learner in person',
      family: 'The family member the learner linked to their account',
      support: 'SABI support answering by phone or WhatsApp',
    },
  },
  priority: {
    type: 'choice',
    instructions: 'How soon should someone respond?',
    criteria: {
      now: 'Today, because the learner is stuck, upset or unsafe',
      soon: 'Within the next few days',
      whenever: 'At the next class or when someone is free',
    },
  },
} as const;

/** Highest-probability route, or null when no route is clear enough to act on. */
export function chooseRoute(probabilities: Record<string, number>): TriageRoute | null {
  let best: TriageRoute | null = null;
  let bestProbability = 0;
  for (const route of TRIAGE_ROUTES) {
    const probability = probabilities[route];
    if (typeof probability === 'number' && probability > bestProbability) {
      best = route;
      bestProbability = probability;
    }
  }
  return best && bestProbability >= ROUTE_MIN_PROBABILITY ? best : null;
}

/** Urgency wins over the priority answer: a learner in trouble is served now. */
export function choosePriority(probabilities: Record<string, number>, urgency: number | null): TriagePriority {
  if (urgency !== null && urgency >= URGENT_MIN_PROBABILITY) return 'now';
  let best: TriagePriority = 'soon';
  let bestProbability = 0;
  for (const priority of TRIAGE_PRIORITIES) {
    const probability = probabilities[priority];
    if (typeof probability === 'number' && probability > bestProbability) {
      best = priority;
      bestProbability = probability;
    }
  }
  return bestProbability >= ROUTE_MIN_PROBABILITY ? best : 'soon';
}

/** A compact case state: never names, numbers or free-form learner text. */
function caseState(input: TriageCase): Record<string, unknown> {
  const lessonSlug = input.context?.lessonSlug;
  return {
    app: 'SABI',
    requestType: input.requestType,
    language: input.lang,
    lesson: typeof lessonSlug === 'string' ? lessonSlug.slice(0, 80) : null,
  };
}

function localDecision(input: TriageCase): TriageDecision {
  const route: TriageRoute = input.requestType === 'whatsapp' ? 'family' : 'facilitator';
  const priority: TriagePriority = input.requestType === 'call_back' ? 'now' : 'soon';
  return {
    route,
    priority,
    urgent: priority === 'now',
    source: 'local',
    model: null,
    probabilities: {},
    requestId: null,
  };
}

function readChoice(answer: unknown): DrexChoiceAnswer | null {
  if (!answer || typeof answer !== 'object') return null;
  const record = answer as { choice?: unknown; probabilities?: unknown };
  if (typeof record.choice !== 'string') return null;
  if (!record.probabilities || typeof record.probabilities !== 'object') return null;
  const probabilities: Record<string, number> = {};
  for (const [label, value] of Object.entries(record.probabilities as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value)) probabilities[label] = value;
  }
  return { choice: record.choice, probabilities };
}

function readNoul(answer: unknown): number | null {
  if (!answer || typeof answer !== 'object') return null;
  const value = (answer as { noul?: unknown }).noul;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Ask Drex who should handle a help request and how soon it needs an answer. */
export async function triageHelpRequest(input: TriageCase, env: Env): Promise<TriageDecision> {
  const local = localDecision(input);
  if (!env.naceApiKey) return local;

  let response: Response;
  try {
    response = await fetch(DREX_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.naceApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DREX_MODEL,
        state: caseState(input),
        questions: QUESTIONS,
      }),
      signal: AbortSignal.timeout(DREX_TIMEOUT_MS),
    });
  } catch {
    console.warn('[drex] no answer for help triage; routing locally');
    return local;
  }

  if (!response.ok) {
    console.warn(`[drex] help triage answered ${response.status}; routing locally`);
    return local;
  }

  let data: DrexResponse;
  try {
    data = (await response.json()) as DrexResponse;
  } catch {
    console.warn('[drex] help triage returned unreadable JSON; routing locally');
    return local;
  }

  const routeAnswer = readChoice(data.answers?.route);
  const priorityAnswer = readChoice(data.answers?.priority);
  const urgency = readNoul(data.answers?.urgent);
  const route = routeAnswer ? chooseRoute(routeAnswer.probabilities) : null;
  const priority = priorityAnswer ? choosePriority(priorityAnswer.probabilities, urgency) : null;

  return {
    route: route ?? local.route,
    priority: priority ?? local.priority,
    urgent: (urgency ?? 0) >= URGENT_MIN_PROBABILITY,
    source: 'drex',
    model: typeof data.model === 'string' ? data.model : DREX_MODEL,
    probabilities: routeAnswer?.probabilities ?? {},
    requestId: typeof data.request_id === 'string' ? data.request_id : null,
  };
}