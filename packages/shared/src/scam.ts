import type { ScamVerdict } from './types';
import { analyzeSensitive, isSensitiveWarning } from './safety';

/**
 * Rule-based scam detector. It is deliberately hedged ("looks like", "very
 * likely") and never says a message is definitely safe. Credential requests
 * are always treated as a scam, regardless of other signals.
 */

interface Rule {
  id: string;
  weight: number;
  reason: string;
  test: (text: string, ctx: Ctx) => boolean;
}

interface Ctx {
  urls: string[];
  unknownLink: boolean;
}

const KNOWN_HOSTS = [
  'gtbank.com',
  'firstbanknigeria.com',
  'zenithbank.com',
  'ubagroup.com',
  'accessbankplc.com',
  'opay.ng',
  'palmpay.com',
  'moniepoint.com',
  'kuda.com',
  'unionbankng.com',
  'sterling.ng',
  'fidelitybank.ng',
  'wemabank.com',
  'polarisbanklimited.com',
  'ecobank.com',
  'cbn.gov.ng',
  'ncc.gov.ng',
  'nimc.gov.ng',
  'nin.gov.ng',
  'pencom.gov.ng',
  'mtn.ng',
  'mtnonline.com',
  'glo.com',
  'airtel.com.ng',
  '9mobile.com.ng',
  'whatsapp.com',
  'wa.me',
  'google.com',
  'microsoft.com',
  'apple.com',
  'amazon.com',
  'facebook.com',
  'instagram.com',
  'dhl.com',
  'fedex.com',
  'ups.com',
  'jumia.com.ng',
  'konga.com',
  'airpeace.com',
];

const URL_RE = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;

function extractHosts(text: string): string[] {
  const urls = text.match(URL_RE) ?? [];
  return urls.map((u) => {
    const cleaned = u.replace(/^www\./i, '').replace(/^https?:\/\//i, '');
    return cleaned.split(/[/?#]/)[0].toLowerCase();
  });
}

function isKnownHost(host: string): boolean {
  return KNOWN_HOSTS.some((k) => host === k || host.endsWith(`.${k}`));
}

const CREDENTIAL_PROXIMITY: RegExp[] = [
  /(?:send|share|give|provide|reply with|tell (?:me|us)|enter|type|confirm|read out|submit|forward)[^.!?\n]{0,60}(?:pin|otp|password|bvn|nin|card(?:\s*number)?|cvv|verification code|security code|code (?:we|they) (?:just )?sent|6[- ]digit code)/i,
  /(?:pin|otp|password|bvn|nin|card(?:\s*number)?|cvv|verification code|security code)[^.!?\n]{0,50}(?:send|share|give|reply|provide|confirm|read out|submit)/i,
  /(?:account number)[^.!?\n]{0,50}(?:send|share|give|provide|reply|confirm)/i,
];

const WARNING_RE = isSensitiveWarning;

/** A real bank alert points at the number printed on the card, not a stranger. */
const CARD_NUMBER_HINT = /number on (?:the )?(?:back of )?(?:your|the) card/i;

const RULES: Rule[] = [
  {
    id: 'credential_request',
    weight: 9,
    reason: 'It asks you to send or say your PIN, OTP, password, BVN or card details.',
    test: (t) => CREDENTIAL_PROXIMITY.some((re) => re.test(t)),
  },
  {
    id: 'urgency',
    weight: 2,
    reason: 'It tries to make you act fast, before you can think or ask someone.',
    test: (t) =>
      /\b(urgent|immediately|right now|within (?:24|48) hours|final warning|last warning|expires?|expiring|suspended|deactivated|will be (?:closed|blocked|barred|locked)|account (?:is )?(?:closed|blocked|locked))\b/i.test(
        t,
      ),
  },
  {
    id: 'threat',
    weight: 2,
    reason: 'It threatens to close, block or bar your account or line.',
    test: (t) =>
      /\b(account|card|sim|line|number|service)\b[^.!?\n]{0,40}\b(will|go|don'?t|has been|have been)\b[^.!?\n]{0,20}\b(close|block|suspend|deactivate|bar|lock)(?:ed|s)?\b/i.test(
        t,
      ),
  },
  {
    id: 'prize',
    weight: 3,
    reason: 'It says you won a prize or a big reward that you did not apply for.',
    test: (t) =>
      /\b(you (?:have )?(?:won|don win)|congratulations?|winner|lottery|jackpot|cash prize|claim (?:your )?(?:prize|reward)|lucky winner|free (?:iphone|phone|gift)|government grant|selected for a (?:grant|loan))\b/i.test(
        t,
      ),
  },
  {
    id: 'unknown_link',
    weight: 3,
    reason: 'It contains a link that is not a known bank or government website.',
    test: (_t, ctx) => ctx.unknownLink,
  },
  {
    id: 'link_push',
    weight: 2,
    reason: 'It pushes you to click a link.',
    test: (t) => /\b(click|tap|follow)\b[^.!?\n]{0,25}\b(here|this link|the link|below)\b/i.test(t),
  },
  {
    id: 'impersonation',
    // Claiming to be a bank is not evidence on its own: real banks send real
    // messages. It only adds a reason to the explanation.
    weight: 0,
    reason: 'It claims to be from a bank, government office or network company.',
    test: (t) =>
      /\b(gtbank|gtb|first ?bank|zenith|uba|access ?bank|opay|palmpay|moniepoint|kuda|union bank|sterling|fidelity|wema|polaris|ecobank|cbn|efcc|nimc|nin|pencom|pension|mtn|glo|airtel|9mobile|whatsapp|meta|microsoft|google|customer care|security team|from your bank)\b/i.test(
        t,
      ),
  },
  {
    id: 'payment_request',
    weight: 3,
    reason: 'It asks you to send money or pay a fee to receive something.',
    test: (t) =>
      /\b(send|transfer|pay|deposit)\b[^.!?\n]{0,35}(money|₦|naira|fee|airtime|account|card|\d{3,})/i.test(t) ||
      /\b(processing|activation|delivery|clearance|customs|registration|service|tax|verification) fee\b/i.test(t),
  },
  {
    id: 'secrecy',
    weight: 3,
    reason: 'It tells you to keep it secret or not to tell your family or bank.',
    test: (t) =>
      /\b(don'?t|do not|no need to)\s+(tell|inform|call)\b[^.!?\n]{0,30}\b(anyone|anybody|family|bank|police)\b/i.test(t) ||
      /\bkeep (?:this|it) (?:between us|secret)\b/i.test(t),
  },
  {
    id: 'new_number',
    weight: 3,
    reason: 'It comes from a "new number" and asks for help or money.',
    test: (t) => /\b(this is|na) my new (?:number|phone|line)\b|\bi (?:lost|changed) my (?:phone|number|line)\b/i.test(t),
  },
  {
    id: 'relative_trouble',
    weight: 2,
    reason: 'It claims a relative is in trouble and needs money quickly.',
    test: (t) =>
      /\b(accident|hospital|arrested|police station|stranded|kidnap|emergency)\b/i.test(t) &&
      /\b(money|send|pay|transfer|naira|₦)\b/i.test(t),
  },
  {
    id: 'job_loan',
    weight: 2,
    reason: 'It offers a job or loan with no normal checks.',
    test: (t) =>
      /\b(job offer|work from home|no interview|no experience|instant loan|loan approved|no collateral|recruitment|salary advance)\b/i.test(
        t,
      ),
  },
  {
    id: 'investment',
    weight: 2,
    reason: 'It promises quick or guaranteed profit.',
    test: (t) => /\b(double your money|guaranteed profit|investment|bitcoin|crypto|forex|roi|profit in \d+ days)\b/i.test(t),
  },
  {
    id: 'extortion',
    weight: 3,
    reason: 'It threatens you if you do not pay.',
    test: (t) =>
      /\b(or (?:else )?(?:you|we) (?:will|go)|if you (?:do not|don'?t) (?:pay|send)|you will (?:not|never) (?:see|hear))\b/i.test(
        t,
      ),
  },
  {
    id: 'call_redirect',
    weight: 2,
    reason: 'It tells you to call or WhatsApp a number, instead of the number on your card.',
    test: (t) =>
      !CARD_NUMBER_HINT.test(t) &&
      (/\b(call|dial|whatsapp|text)\b[^.!?\n]{0,25}\b(?:this|the)\s+(?:number|line)\b/i.test(t) ||
        /\b(call|dial|whatsapp)\b[^.!?\n]{0,15}(?:\+?234|0)\d{9,10}\b/i.test(t)),
  },
  {
    id: 'airtime_gift',
    weight: 1,
    reason: 'It offers a free gift, airtime or data.',
    test: (t) => /\b(free (?:airtime|data|gift)|you have received|bonus)\b/i.test(t),
  },
];

const SAFE_SIGNALS: Array<{ id: string; weight: number; test: (t: string) => boolean }> = [
  { id: 'credential_warning', weight: -3, test: (t) => isSensitiveWarning(t) },
  {
    id: 'education',
    weight: -2,
    test: (t) => /\b(for (?:education|training)|this is a (?:test|sample)|scam awareness|example of a scam)\b/i.test(t),
  },
];

export interface ScamAnalysis extends ScamVerdict {
  score: number;
  matchedRules: string[];
}

export function analyzeMessage(raw: string): ScamAnalysis {
  const text = String(raw ?? '').trim();
  const hosts = extractHosts(text);
  const unknownLink = hosts.some((h) => !isKnownHost(h));
  const ctx: Ctx = { urls: hosts, unknownLink };

  const sensitive = analyzeSensitive(text);
  const matched: Array<{ rule: Rule; reason: string }> = [];
  let score = 0;

  const warned = isSensitiveWarning(text);
  for (const rule of RULES) {
    if (rule.test(text, ctx)) {
      // A warning about credentials is not itself a request.
      if (rule.id === 'credential_request' && warned) continue;
      matched.push({ rule, reason: rule.reason });
      score += rule.weight;
    }
  }
  for (const sig of SAFE_SIGNALS) {
    if (sig.test(text)) score += sig.weight;
  }
  score = Math.max(0, score);

  // A message that asks the reader for a credential is always a scam. A bare
  // 'share' in a protective warning ("never share your OTP") is not a request.
  const critical =
    matched.some((m) => m.rule.id === 'credential_request') || (sensitive.isRequest && !warned);
  const redFlags = matched.map((m) => m.rule.id);

  let verdict: ScamVerdict['verdict'];
  if (critical) verdict = 'scam';
  else if (score >= 5) verdict = 'scam';
  else if (score >= 2) verdict = 'unsure';
  else verdict = 'safe';

  const reasons = matched
    .slice()
    .sort((a, b) => b.rule.weight - a.rule.weight)
    .slice(0, 3)
    .map((m) => m.reason);

  const headline =
    verdict === 'scam'
      ? 'Looks like a SCAM — do not reply'
      : verdict === 'unsure'
        ? "I'm not sure — ask a person before you reply"
        : 'Looks safe, but be careful';

  const nextSteps =
    verdict === 'scam'
      ? [
          'Do not reply, and do not press any link.',
          'Do not send money or any code.',
          'Block the sender and tell a family member you trust.',
          'Call your bank using the number on the back of your card.',
        ]
      : verdict === 'unsure'
        ? [
            'Do not send money or any code.',
            'Ask a family member or your facilitator to look at it.',
            'If it says it is your bank, call the number on the back of your card.',
          ]
        : [
            'Still never share your PIN, OTP or password.',
            'If you are not sure, ask a person you trust.',
            'Delete messages from people you do not know.',
          ];

  if (verdict === 'safe' && reasons.length === 0) {
    reasons.push('We did not see the usual scam warning signs.');
  }
  if (verdict === 'scam' && critical) {
    reasons.unshift('Banks never ask for your PIN, OTP, password, BVN or card details.');
  }

  const confidence =
    verdict === 'scam'
      ? Math.min(0.97, 0.62 + score * 0.05)
      : verdict === 'unsure'
        ? Math.min(0.7, 0.45 + score * 0.05)
        : Math.max(0.5, 0.8 - score * 0.05);

  return {
    verdict,
    confidence: Number(confidence.toFixed(2)),
    headline,
    reasons,
    nextSteps,
    redFlags,
    critical,
    score,
    matchedRules: matched.map((m) => m.rule.id),
  };
}

/** Short, calm written summary of a verdict. */
export function verdictToText(v: ScamVerdict): string {
  const first = v.reasons[0] ? ` ${v.reasons[0]}` : '';
  const step = v.nextSteps[0] ? ` ${v.nextSteps[0]}` : '';
  return `${v.headline}.${first}${step}`;
}

export const SCAM_TEST_HINTS = {
  neverSafeWhenCredentialsRequested: true,
};
