import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CRISIS_RESPONSES,
  SENSITIVE_REPLY,
  analyzeSensitive,
  containsSecretValue,
  detectCrisis,
  redactSensitive,
  sanitizeReply,
  type Lang,
  type VoiceReply,
} from '@sabi/shared';
import type { Env } from '../env';
import type { Store } from '../store';
import { getLlmProvider } from '../providers';
import { synthesizeCached } from '../tts';

export const PROMPT_VERSION = 'assistant.v1';

const PROMPT_PATH = path.resolve(fileURLToPath(new URL('./prompts/assistant.v1.md', import.meta.url)));
let systemPrompt = 'You are a kind helper for older adults in Nigeria. Never ask for PINs, OTPs, passwords, BVN or card details.';
try {
  systemPrompt = fs.readFileSync(PROMPT_PATH, 'utf8');
} catch {
  /* keep the safe fallback */
}

const STOP = new Set(['the', 'and', 'for', 'how', 'what', 'why', 'can', 'you', 'your', 'with', 'this', 'that', 'from', 'about', 'please', 'help', 'want', 'know', 'does', 'mean', 'into', 'when', 'where', 'which', 'have', 'has', 'are', 'was', 'will', 'would', 'should', 'could', 'them', 'they', 'there', 'here', 'not', 'but', 'all', 'any', 'get', 'use', 'using', 'make']);

function tokens(text: string): string[] {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function retrieve(text: string, store: Store): { context: string; sources: string[] } {
  const words = new Set(tokens(text));
  const scored: Array<{ score: number; text: string; id: string }> = [];
  for (const lesson of store.data.lessons) {
    const blob = `${lesson.title} ${lesson.steps.map((s) => s.text).join(' ')}`;
    let score = 0;
    for (const w of new Set(tokens(blob))) if (words.has(w)) score += 1;
    if (score > 0) scored.push({ score, text: `${lesson.title}: ${lesson.steps.map((s) => s.text).join(' ')}`, id: lesson.slug });
  }
  for (const g of store.data.glossary) {
    let score = 0;
    for (const w of new Set(tokens(`${g.term} ${g.explanation}`))) if (words.has(w)) score += 1;
    if (score > 0) scored.push({ score, text: `${g.term}: ${g.explanation}`, id: g.id });
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  return { context: top.map((t) => `- ${t.text}`).join('\n'), sources: top.map((t) => t.id) };
}

const AI_PATTERN =
  /\b(are you|is this|am i talking to)\b[^.!?\n]{0,40}\b(human|real person|robot|ai|a\.i\.|doctor|machine)\b/i;
const ADVICE_PATTERN =
  /\b(medicine|malaria|drug|dose|dosage|doctor|nurse|hospital|symptom|treat|chest pain|will|sue|lawyer|legal|land matter|interest rate|invest|investment|bitcoin|crypto|pension|loan|mortgage|insurance)\b/i;
const ASK_SECRET_PATTERN =
  /\b(my|your|the)\s+(?:\w+\s+){0,2}(pin|otp|password|bvn|nin|card number|cvv|bank account|account number)\b/i;
const ASK_SECRET_VERB =
  /\b(what|tell|give|send|read|repeat|say|show|remember|store|find|type|enter|confirm|write|pretend|ask|share|provide)\b/i;

function isAskingForSecret(text: string): boolean {
  const sensitive = analyzeSensitive(text);
  if (sensitive.isRequest) return true;
  if (containsSecretValue(text)) return true;
  if (ASK_SECRET_PATTERN.test(text) && ASK_SECRET_VERB.test(text)) return true;
  if (/\bmy\s+(pin|otp|password|bvn|card number)\s+(is|na|=)/i.test(text)) return true;
  if (/\b(pretend|write|ask|request|tell)\b[^.!?\n]{0,50}\b(pin|otp|password|bvn)\b/i.test(text)) return true;
  return false;
}

const MOCK_ANSWERS: Array<{ test: RegExp; en: string; pcm: string }> = [
  {
    test: /\b(voice note|voice message|microphone|record)\b/i,
    en: 'Open the chat. Hold the small microphone at the bottom and speak. Lift your finger to send it.',
    pcm: 'Open di chat. Hold di small microphone down and talk. Lift your finger to send am.',
  },
  {
    test: /\b(balance|account balance)\b/i,
    en: 'Open your bank app yourself, not a link. Enter your PIN in the app, then press Balance. Log out when you finish.',
    pcm: 'Open your bank app yourself, no be link. Put your PIN inside di app, press Balance. Log out when you finish.',
  },
  {
    test: /\b(otp|one[- ]time (password|code))\b/i,
    en: 'OTP means one-time password. It is a short code sent to your phone. Never share it with anybody, even if they say they are from the bank.',
    pcm: 'OTP mean one-time password. Na short code wey dem send your phone. No ever share am with anybody.',
  },
  {
    test: /\b(block|report)\b/i,
    en: "Open the message. Press the sender's name or number. Choose Block, then Delete.",
    pcm: 'Open di message. Press di sender name or number. Choose Block, then Delete.',
  },
  {
    test: /\b(video call|video)\b/i,
    en: 'Open the chat on WhatsApp. Press the small camera at the top. Press the red button to stop.',
    pcm: 'Open di chat for WhatsApp. Press di small camera on top. Press red button to stop.',
  },
  {
    test: /\b(send money|transfer|pay)\b/i,
    en: 'Open your bank app. Press Transfer. Type the account number and the amount, check the name, then confirm. Never send money to a stranger.',
    pcm: 'Open your bank app. Press Transfer. Put di account number and amount, check di name, then confirm. No send money to stranger.',
  },
  {
    test: /\b(scam|fake|fraud|safe)\b/i,
    en: 'Do not reply and do not press any link. Ask a person you trust, or use the Scam checker in this app.',
    pcm: 'No reply and no press any link. Ask person you trust, or use di Scam checker inside dis app.',
  },
  {
    test: /\b(wifi|wi-fi|data|internet|airtime)\b/i,
    en: 'Wi-Fi comes from a router and does not use your airtime. Mobile data comes from your network and uses your airtime. Ask for the Wi-Fi password before you join.',
    pcm: 'Wi-Fi dey come from router, e no dey use your airtime. Mobile data dey use your airtime. Ask for di Wi-Fi password before you join.',
  },
  {
    test: /\b(photo|picture|camera)\b/i,
    en: 'Open the chat and press the paperclip. Choose Camera or Gallery, then press Send.',
    pcm: 'Open di chat, press di paperclip. Choose Camera or Gallery, then press Send.',
  },
  {
    test: /\b(call|dial|phone)\b/i,
    en: 'Open the green Phone app. Press the numbers you want, then press the green call button. Press red to end the call.',
    pcm: 'Open di green Phone app. Press di numbers, then press di green call button. Press red to end di call.',
  },
  {
    test: /\b(whatsapp|chat|message|group)\b/i,
    en: 'Open WhatsApp and tap the name of the person. Tap the box at the bottom to type, or hold the microphone to speak. Then press Send.',
    pcm: 'Open WhatsApp, tap di person name. Tap di box down to type, or hold di microphone to talk. Then press Send.',
  },
];

function mockAnswer(text: string, lang: Lang): string {
  const found = MOCK_ANSWERS.find((a) => a.test.test(text));
  if (found) return lang === 'pcm' ? found.pcm : found.en;
  return lang === 'pcm'
    ? 'I no too sure about dat one. I can ask human helper to call you. You want make I do am?'
    : 'I am not sure about that one. I can ask a human helper to call you. Would you like me to do that?';
}

export interface AnswerInput {
  text: string;
  lang: Lang;
  confidence: number;
  store: Store;
  env: Env;
  userId: string | null;
  isTyped?: boolean;
  latencyMs?: number;
}

export async function answerQuestion(input: AnswerInput): Promise<VoiceReply> {
  const started = Date.now();
  const rawText = String(input.text ?? '').trim().slice(0, 600);
  const lang = input.lang;
  const confidence = input.isTyped ? 0.98 : input.confidence;
  const replyLang: Lang = lang === 'pcm' || lang === 'en' ? lang : 'en';

  let reply = '';
  let flagged: string | null = null;
  let needsConfirm = false;
  let confirmQuestion: string | null = null;
  let transcript = rawText;

  const crisis = detectCrisis(rawText);
  if (crisis) {
    reply = CRISIS_RESPONSES[crisis] ?? CRISIS_RESPONSES.distress;
    flagged = `crisis:${crisis}`;
  } else if (isAskingForSecret(rawText)) {
    reply = `${SENSITIVE_REPLY} I will not repeat it or keep it.`;
    flagged = 'pii_attempt';
    transcript = '';
  } else if (AI_PATTERN.test(rawText)) {
    reply = 'I am an AI helper, not a human. I can make mistakes. Never share your PIN or OTP with me.';
    flagged = 'ai_disclosure';
  } else if (ADVICE_PATTERN.test(rawText)) {
    reply =
      'I cannot give medical, legal or money advice. Please speak to a doctor, a lawyer, or your bank. I can connect you to a person who can help.';
    flagged = 'advice_redirect';
  } else if (!rawText) {
    reply = 'I could not hear that clearly. Please try again, or talk to a person.';
    needsConfirm = true;
    confirmQuestion = reply;
    flagged = 'low_confidence';
  } else if (!input.isTyped && confidence < input.env.confThreshold) {
    reply = `Did you say: "${redactSensitive(rawText)}"?`;
    needsConfirm = true;
    confirmQuestion = reply;
    flagged = 'low_confidence';
  } else {
    const { context } = retrieve(rawText, input.store);
    const llm = getLlmProvider(input.env);
    if (llm) {
      try {
        const prompt = systemPrompt
          .replace('{language}', lang)
          .replace('{context}', context || 'No lesson context found.');
        const out = await llm.chat(
          [
            { role: 'system', content: prompt },
            { role: 'user', content: rawText },
          ],
          { temperature: 0.3, maxTokens: 220 },
        );
        reply = out || mockAnswer(rawText, lang);
      } catch {
        reply = mockAnswer(rawText, lang);
      }
    } else {
      reply = mockAnswer(rawText, lang);
    }
    if (replyLang !== lang) {
      reply = `${reply} (English fallback.)`;
    }
  }

  const sanitized = sanitizeReply(reply);
  if (sanitized.flagged) flagged = flagged ?? 'unsafe_reply';
  reply = sanitized.reply;

  let audioUrl: string | null = null;
  if (input.env.nodeEnv !== 'test' && !needsConfirm) {
    try {
      const tts = await synthesizeCached(reply, replyLang, 0.9, input.env);
      audioUrl = `/api/v1/tts/audio/${tts.hash}`;
    } catch {
      audioUrl = null;
    }
  }

  const latencyMs = input.latencyMs ?? Date.now() - started;
  const storeTranscript = input.userId ? input.store.activeConsent(input.userId, 'store_transcripts') : false;
  input.store.data.voiceExchanges.unshift({
    id: crypto.randomUUID(),
    userId: input.userId,
    lang,
    sttConfidence: confidence,
    transcript: storeTranscript && !flagged ? rawText : null,
    replyPromptVersion: PROMPT_VERSION,
    flaggedEvent: flagged,
    latencyMs,
    createdAt: new Date().toISOString(),
  });
  if (input.store.data.voiceExchanges.length > 5000) input.store.data.voiceExchanges.length = 5000;
  input.store.save();

  return {
    transcript,
    language: lang,
    replyLang,
    confidence,
    reply,
    needsConfirm,
    confirmQuestion,
    audioUrl,
    promptVersion: PROMPT_VERSION,
    safety: { flagged, message: flagged === 'pii_attempt' ? SENSITIVE_REPLY : null },
  };
}
