/**
 * Code-level safety filters. These run on every text input
 * and assistant reply. They never log or return the sensitive value itself.
 */

const SENSITIVE_KINDS: Array<{ kind: string; re: RegExp }> = [
  { kind: 'pin', re: /\b(pin|p\.?\s?i\.?\s?n|personal identification number)\b/i },
  { kind: 'otp', re: /\b(otp|o\.?t\.?p|one[-\s]?time (password|code|pin)|verification code|security code)\b/i },
  { kind: 'password', re: /\b(password|passcode|login details)\b/i },
  { kind: 'bvn', re: /\b(bvn|bank verification number)\b/i },
  { kind: 'nin', re: /\b(nin|national identification number)\b/i },
  { kind: 'card', re: /\b(card number|cvv|cvc|expiry date|atm card|debit card|credit card)\b/i },
  { kind: 'account', re: /\b(account number|bank account)\b/i },
];

const REQUEST_VERB =
  /\b(send|share|give|provide|reply with|tell (me|us)|enter|type|confirm|read out|forward|submit|drop|wetin be)\b/i;

const WARNING =
  /\b(never|do not|don't|dont|nobody|no one|no-one|banks? (will|would) not|we (will|would) never)\b[^.!?\n]{0,90}\b(pin|otp|password|bvn|nin|card|code)\b/i;

/**
 * A protective instruction such as "never share it" or the Pidgin "no ever
 * share your PIN". This is the opposite of a request and must never be treated
 * as one.
 */
const WARNING_SHARE =
  /\b(never|do not|don't|dont|no ever|no go|no dey|make you no|abeg no)\b[^.!?\n]{0,40}\b(share|give|send|tell|read out|type|repeat)\b[^.!?\n]{0,25}\b(it|them|this|that|the code|am|your (?:pin|otp|password|bvn|nin|card))\b/i;

const CRISIS: Array<{ kind: string; re: RegExp }> = [
  {
    kind: 'money_sent',
    re: /\b(i (have )?(already )?(sent|transferred|paid)|i (have )?been (scammed|defrauded)|they (have )?(taken|collected)|i (was|got) (scammed|defrauded)|dem (don )?(collect|take) my money)\b[^.!?\n]{0,60}\b(money|naira|₦|n\d{3,}|transfer|account)?/i,
  },
  {
    kind: 'credential_shared',
    re: /\b(i (shared|gave|sent|typed)|dem (share|give|send))\b[^.!?\n]{0,40}\b(otp|pin|password|bvn|code)\b/i,
  },
  {
    kind: 'self_harm',
    re: /\b(kill myself|end my life|suicide|wan die|i want to die)\b/i,
  },
  {
    kind: 'abuse',
    re: /\b(he (is|dey) (beating|hitting) me|she (is|dey) (beating|hitting) me|abusing me|threaten(ing)? to kill|(husband|wife|partner|son|daughter)[^.!?\n]{0,30}(beating|hitting|abusing))\b/i,
  },
  {
    kind: 'medical_emergency',
    re: /\b(i (have|get|am having|dey feel)|my)\b[^.!?\n]{0,30}\b(chest pain|cannot breathe|can't breathe|stroke|unconscious)\b|\b(i cannot breathe|i can't breathe|i am bleeding|bleeding heavily)\b/i,
  },
  {
    kind: 'distress',
    re: /\b(hospital|emergency|accident|in danger|scared|afraid)\b[^.!?\n]{0,80}\b(help|scared|afraid|please)\b/i,
  },
];

/** Digits that look like a secret value. */
const SECRET_DIGITS = /\b\d{4,}\b/g;

export function isSensitiveWarning(raw: string): boolean {
  const text = String(raw ?? '');
  return WARNING.test(text) || WARNING_SHARE.test(text);
}

export interface SensitiveAnalysis {
  hasSensitiveTerm: boolean;
  isRequest: boolean;
  isWarning: boolean;
  kinds: string[];
  hasSecretValue: boolean;
}

export function analyzeSensitive(raw: string): SensitiveAnalysis {
  const text = String(raw ?? '');
  const kinds = SENSITIVE_KINDS.filter((k) => k.re.test(text)).map((k) => k.kind);
  const hasSensitiveTerm = kinds.length > 0;
  const isWarning = WARNING.test(text) || WARNING_SHARE.test(text);
  const isRequest = hasSensitiveTerm && REQUEST_VERB.test(text) && !isWarning;
  const hasSecretValue = /\b\d{6,}\b/.test(text) || /(?:\d[ -]?){13,19}/.test(text);
  return { hasSensitiveTerm, isRequest, isWarning, kinds, hasSecretValue };
}

/**
 * Returns true when a message appears to ask the learner to hand over a
 * credential. Used by the assistant, the scam checker and the sandbox.
 */
export function asksForCredentials(raw: string): boolean {
  return analyzeSensitive(raw).isRequest;
}

/** Remove anything that could be a secret before it reaches a log or a reply. */
export function redactSensitive(raw: string): string {
  let text = String(raw ?? '');
  // Mask long digit strings (OTP, account, card, phone).
  text = text.replace(/(?:\d[ -]?){6,19}\d/g, '[number removed]');
  text = text.replace(SECRET_DIGITS, '[number removed]');
  // Mask the value following a credential word, e.g. "PIN is 1234".
  text = text.replace(
    /\b(pin|otp|password|bvn|nin|code|card number|cvv)\b(\s*(?:is|na|be)?\s*[:=-]?\s*)\S+/gi,
    (_m, kind: string) => `${kind} [removed]`,
  );
  return text;
}

/** True when a string contains a value we must never log. */
export function containsSecretValue(raw: string): boolean {
  return /\b\d{6,}\b/.test(String(raw ?? '')) || /(?:\d[ -]?){13,19}/.test(String(raw ?? ''));
}

export function detectCrisis(raw: string): string | null {
  const text = String(raw ?? '');
  for (const c of CRISIS) {
    if (c.re.test(text)) return c.kind;
  }
  return null;
}

export const CRISIS_RESPONSES: Record<string, string> = {
  money_sent:
    'I am sorry this happened. Do not send more money. Call your bank now using the number on the back of your card, then tell a family member you trust. I can also connect you to a person who can help.',
  credential_shared:
    'Please stay calm. Do not share it again. Call your bank now using the number on the back of your card and ask them to protect your account. Tell a family member you trust. I can connect you to a person now.',
  self_harm:
    'I am really sorry you feel this way. Please do not stay alone. Call a family member or a trusted person now, or go to the nearest clinic. I can connect you to a human helper.',
  abuse:
    'Your safety matters. Please move to a safe place and call someone you trust, or the police. I can connect you to a human helper now.',
  medical_emergency:
    'Please call for help now. Ask someone near you to take you to the nearest clinic or call emergency services. I can connect you to a person.',
  distress:
    'I am here with you. Please do not stay alone. Tell a family member or someone you trust, and I can connect you to a human helper now.',
};

export const SENSITIVE_REPLY =
  'Please never share your PIN, OTP, password, BVN or card details with anyone. Not even with me. Banks never ask for them. Keep them secret.';

/**
 * Guidance to use a credential inside the learner's own bank app is safe and
 * must not be replaced: "Enter your PIN in the app, then press Balance".
 */
const SELF_SERVICE =
  /\b(enter|type|put|press)\b[^.!?\n]{0,40}\b(in|inside|into)\b[^.!?\n]{0,20}\b(?:the|your)\s+(?:bank\s+)?app\b/i;

/** Assistant replies must never echo a secret or ask for one. */
export function sanitizeReply(reply: string): { reply: string; flagged: boolean } {
  const text = String(reply ?? '');
  if (containsSecretValue(text)) {
    return { reply: SENSITIVE_REPLY, flagged: true };
  }
  if (asksForCredentials(text) && !SELF_SERVICE.test(text)) {
    return { reply: SENSITIVE_REPLY, flagged: true };
  }
  return { reply: text, flagged: false };
}
