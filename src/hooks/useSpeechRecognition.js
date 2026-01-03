import { useEffect, useMemo, useRef, useState } from "react";

export function useSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  const supported = !!SpeechRecognition;

  const recRef = useRef(null);
  const langRef = useRef("en-US");

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [finalText, setFinalText] = useState("");
  const [error, setError] = useState("");

  // Create recognizer once
  useEffect(() => {
    if (!supported) return;

    const rec = new SpeechRecognition();
    recRef.current = rec;

    // Defaults (can be changed before start)
    rec.lang = langRef.current;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onstart = () => {
      setError("");
      setListening(true);
    };

    rec.onend = () => {
      setListening(false);
      setInterim("");
      // keep finalText until reset()
    };

    rec.onerror = (e) => {
      setError(e?.error || "unknown_error");
      setListening(false);
    };

    rec.onresult = (event) => {
      let interimAcc = "";
      let finalAcc = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const txt = res[0]?.transcript || "";
        if (res.isFinal) finalAcc += txt;
        else interimAcc += txt;
      }

      if (interimAcc) setInterim(interimAcc.trim());
      if (finalAcc) setFinalText((prev) => `${prev} ${finalAcc}`.trim());
    };

    return () => {
      try {
        rec.abort();
      } catch {}
      recRef.current = null;
    };
  }, [supported]);

  const api = useMemo(() => {
    const start = ({ lang } = {}) => {
      if (!supported || !recRef.current) return;
      if (lang) {
        langRef.current = lang;
        recRef.current.lang = lang;
      }
      setError("");
      setInterim("");
      // keep finalText until reset() so user can “Send Speech”
      try {
        recRef.current.start();
      } catch (e) {
        // start can throw if called twice quickly
      }
    };

    const stop = () => {
      if (!supported || !recRef.current) return;
      try {
        recRef.current.stop();
      } catch {}
    };

    const reset = () => {
      setInterim("");
      setFinalText("");
      setError("");
    };

    const setLang = (lang) => {
      langRef.current = lang;
      if (recRef.current) recRef.current.lang = lang;
    };

    return {
      supported,
      listening,
      interim,
      finalText,
      error,
      start,
      stop,
      reset,
      setLang,
      get lang() {
        return langRef.current;
      },
    };
  }, [supported, listening, interim, finalText, error]);

  return api;
}
