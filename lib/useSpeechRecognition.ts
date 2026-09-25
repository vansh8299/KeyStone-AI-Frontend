"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: { readonly length: number; [index: number]: SpeechRecognitionResult };
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getRecognitionClass(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings to use voice input.",
  "service-not-allowed": "Voice input isn't allowed in this browser.",
  "audio-capture": "No microphone was found. Connect one and try again.",
  "no-speech": "Didn't hear anything. Try again and speak after the mic turns red.",
  network: "Voice input needs an internet connection to your browser's speech service.",
  "language-not-supported": "Voice input doesn't support your browser's language.",
};

// Browser support can't change while the page is open, so there's nothing to subscribe to.
const noSubscription = () => () => {};
const detectSupport = () => getRecognitionClass() !== null && window.isSecureContext;

export interface SpeechRecognitionHandlers {
  onTranscript: (finalText: string, interimText: string) => void;
}

export function useSpeechRecognition({ onTranscript }: SpeechRecognitionHandlers) {
  // false on the server; the browser's answer takes over after hydration.
  const supported = useSyncExternalStore(noSubscription, detectSupport, () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionInstance | null>(null);
  const handler = useRef(onTranscript);
  useLayoutEffect(() => {
    handler.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => () => recognition.current?.abort(), []);

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    const rec = recognition.current;
    if (!rec) return;
    rec.onresult = null;
    rec.abort();
  }, []);

  const start = useCallback(() => {
    const Recognition = getRecognitionClass();
    if (!Recognition || recognition.current) return;
    setError(null);

    const rec = new Recognition();
    rec.lang = navigator.language || "en-US";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let finalText = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const text = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += text;
        else interim += text;
      }
      handler.current(finalText, interim);
    };
    rec.onerror = (e) => {
      if (e.error === "aborted") return;
      setError(ERROR_MESSAGES[e.error] ?? "Voice input stopped because of an error.");
    };
    rec.onend = () => {
      recognition.current = null;
      setListening(false);
    };

    try {
      rec.start();
      recognition.current = rec;
      setListening(true);
    } catch {
      setError("Voice input couldn't start. Try again.");
    }
  }, []);

  return { supported, listening, error, start, stop, cancel, clearError: () => setError(null) };
}
