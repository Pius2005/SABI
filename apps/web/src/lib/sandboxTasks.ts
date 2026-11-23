import type { SandboxApp, SandboxTask } from '@sabi/shared';

export interface PracticeTask extends SandboxTask {
  id: string;
  hint: string;
}

export const SANDBOX_TASKS: Record<string, PracticeTask> = {
  'sandbox.dialer.call': {
    id: 'sandbox.dialer.call',
    app: 'dialer',
    target: 'call-button',
    instructionKey: 'sandbox.dialer.call',
    instruction: 'Press the green call button to make the call.',
    hint: 'Look for the round button with the phone shape at the bottom of the keypad.',
  },
  'sandbox.whatsapp.voice_note': {
    id: 'sandbox.whatsapp.voice_note',
    app: 'whatsapp',
    target: 'mic-hold',
    instructionKey: 'sandbox.whatsapp.voice_note',
    instruction: 'Hold the microphone for two seconds, then lift your finger.',
    hint: 'The microphone is at the bottom right of the chat. Keep your finger on it, then lift.',
  },
  'sandbox.whatsapp.open_chat': {
    id: 'sandbox.whatsapp.open_chat',
    app: 'whatsapp',
    target: 'chat-ada',
    instructionKey: 'sandbox.whatsapp.open_chat',
    instruction: 'Tap the chat with Ada.',
    hint: "Ada's name is in the chat list. Tap her row.",
  },
  'sandbox.whatsapp.send': {
    id: 'sandbox.whatsapp.send',
    app: 'whatsapp',
    target: 'send',
    instructionKey: 'sandbox.whatsapp.send',
    instruction: 'Press the green send button.',
    hint: 'The send button is the round button with the arrow beside the message box.',
  },
  'sandbox.whatsapp.attach': {
    id: 'sandbox.whatsapp.attach',
    app: 'whatsapp',
    target: 'attach',
    instructionKey: 'sandbox.whatsapp.attach',
    instruction: 'Press the paperclip to attach a photo.',
    hint: 'The paperclip is beside the message box at the bottom.',
  },
  'sandbox.bank.balance': {
    id: 'sandbox.bank.balance',
    app: 'bank',
    target: 'balance',
    instructionKey: 'sandbox.bank.balance',
    instruction: 'Press Balance to see the practice balance.',
    hint: 'Balance is the first big button on the bank home screen.',
  },
  'sandbox.bank.send_money': {
    id: 'sandbox.bank.send_money',
    app: 'bank',
    target: 'send-money',
    instructionKey: 'sandbox.bank.send_money',
    instruction: 'Press Transfer to start a practice transfer.',
    hint: 'Transfer is the second big button. This is practice only — no real money moves.',
  },
  'sandbox.dialer.ussd': {
    id: 'sandbox.dialer.ussd',
    app: 'dialer',
    target: 'ussd',
    instructionKey: 'sandbox.dialer.ussd',
    instruction: 'Press the USSD shortcut to try a practice code.',
    hint: 'The USSD shortcut is marked with a star and a hash. It is a fake code.',
  },
  'sandbox.sms.block': {
    id: 'sandbox.sms.block',
    app: 'sms',
    target: 'block',
    instructionKey: 'sandbox.sms.block',
    instruction: 'Open the scam message and press Block.',
    hint: 'Open the message from the unknown sender, then press Block at the bottom.',
  },
};

export const SANDBOX_TASK_KEYS = Object.keys(SANDBOX_TASKS);

export function taskForKey(key: string | null | undefined): PracticeTask | null {
  if (!key) return null;
  return SANDBOX_TASKS[key] ?? null;
}

export function tasksForApp(app: SandboxApp): PracticeTask[] {
  return SANDBOX_TASK_KEYS.map((key) => SANDBOX_TASKS[key]).filter((task) => task.app === app);
}

export const SANDBOX_APPS: Array<{ app: SandboxApp; label: string }> = [
  { app: 'dialer', label: 'Phone' },
  { app: 'whatsapp', label: 'WhatsApp' },
  { app: 'bank', label: 'Bank' },
  { app: 'sms', label: 'Messages' },
];
