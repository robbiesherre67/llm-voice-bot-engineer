import { useCallback, useEffect, useMemo, useState } from "react";

export function useSpeechSynthesis() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!supported) return;

    const load = () => {
      const v = window.speechSynthesis.getVoices() || [];
      setVoices(v);
    };

    load();
    window.speechSynthesis.onvoiceschanged = load;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  const stop = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    ({ text, voiceURI, rate = 1, pitch = 1, volume = 1, lang } = {}) => {
      if (!supported) return;
      if (!text?.trim()) return;

      window.speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(text);

      // Prefer explicit voiceURI, else try matching lang
      let chosen = null;

      if (voiceURI) {
        chosen = (window.speechSynthesis.getVoices() || []).find((v) => v.voiceURI === voiceURI);
      }

      if (!chosen && lang) {
        const all = window.speechSynthesis.getVoices() || [];
        // match exact, then prefix match (e.g. "es" for "es-ES")
        chosen =
          all.find((v) => v.lang === lang) ||
          all.find((v) => (v.lang || "").toLowerCase().startsWith((lang || "").toLowerCase().slice(0, 2)));
      }

      if (chosen) u.voice = chosen;
      if (lang) u.lang = lang;

      u.rate = Number(rate);
      u.pitch = Number(pitch);
      u.volume = Number(volume);

      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);

      window.speechSynthesis.speak(u);
    },
    [supported]
  );

  const getVoicesForLang = useCallback(
    (lang) => {
      if (!lang) return voices;
      const pfx = lang.toLowerCase().slice(0, 2);
      return voices.filter((v) => (v.lang || "").toLowerCase().startsWith(pfx));
    },
    [voices]
  );

  return useMemo(
    () => ({
      supported,
      voices,
      speaking,
      speak,
      stop,
      getVoicesForLang,
    }),
    [supported, voices, speaking, speak, stop, getVoicesForLang]
  );
}
