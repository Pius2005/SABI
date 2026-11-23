import { useCallback, useEffect, useRef, useState } from 'react';
import { SPEECH_TAGS, type Lang } from '@sabi/shared';
import { useSettings } from './settings';

interface RecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface RecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: RecognitionAlternative;
}

interface RecognitionResultList {
  length: number;
  [index: number]: RecognitionResult;
}

interface RecognitionEvent extends Event {
  resultIndex: number;
  results: RecognitionResultList;
}

interface RecognitionErrorEvent extends Event {
  error: string;
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => RecognitionLike;

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export interface ListenHandlers {
  onResult?: (text: string, confidence: number) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export interface SpeakOptions {
  lang?: Lang;
  speed?: number;
  onEnd?: () => void;
}

export function useSpeech() {
  const { settings } = useSettings();
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const handlersRef = useRef<ListenHandlers>({});
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const recognitionSupported = typeof window !== 'undefined' && Boolean(getRecognitionConstructor());
  const synthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      /* ignore */
    }
    setListening(false);
  }, []);

  const startListening = useCallback(
    (handlers: ListenHandlers = {}, options: { lang?: Lang } = {}) => {
      const Constructor = getRecognitionConstructor();
      if (!Constructor) {
        handlers.onError?.('unsupported');
        return false;
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          /* ignore */
        }
      }
      const recognition = new Constructor();
      recognition.lang = SPEECH_TAGS[options.lang ?? settings.preferredLang];
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      handlersRef.current = handlers;
      let delivered = false;
      let finalText = '';

      recognition.onstart = () => {
        setListening(true);
        setInterim('');
        setError(null);
      };
      recognition.onresult = (event) => {
        let interimText = '';
        let confidence = 0.9;
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const alternative = result?.[0];
          if (!alternative) continue;
          if (result.isFinal) {
            finalText += alternative.transcript;
            if (alternative.confidence > 0) confidence = alternative.confidence;
          } else {
            interimText += alternative.transcript;
          }
        }
        setInterim(interimText);
        if (finalText.trim() && !delivered) {
          delivered = true;
          handlersRef.current.onResult?.(finalText.trim(), confidence);
          try {
            recognition.stop();
          } catch {
            /* ignore */
          }
        }
      };
      recognition.onerror = (event) => {
        setListening(false);
        setInterim('');
        const message = event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'permission' : event.error;
        setError(message);
        handlersRef.current.onError?.(message);
      };
      recognition.onend = () => {
        setListening(false);
        setInterim('');
        handlersRef.current.onEnd?.();
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
        return true;
      } catch {
        handlers.onError?.('start-failed');
        return false;
      }
    },
    [settings.preferredLang],
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      if (!text.trim() || typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
      const synth = window.speechSynthesis;
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const lang = options.lang ?? settings.preferredLang;
      utterance.lang = SPEECH_TAGS[lang];
      utterance.rate = Math.min(1.5, Math.max(0.5, options.speed ?? settings.voiceSpeed));
      utterance.pitch = 1;
      const voices = synth.getVoices();
      const tag = utterance.lang.toLowerCase();
      const exact = voices.find((voice) => voice.lang.toLowerCase() === tag);
      const languageMatch = voices.find((voice) => voice.lang.toLowerCase().startsWith(tag.slice(0, 2)));
      const chosen = exact ?? languageMatch;
      if (chosen) utterance.voice = chosen;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => {
        setSpeaking(false);
        options.onEnd?.();
      };
      utterance.onerror = () => {
        setSpeaking(false);
        options.onEnd?.();
      };
      utteranceRef.current = utterance;
      synth.speak(utterance);
      return true;
    },
    [settings.preferredLang, settings.voiceSpeed],
  );

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* ignore */
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  return {
    listening,
    speaking,
    interim,
    error,
    recognitionSupported,
    synthesisSupported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
