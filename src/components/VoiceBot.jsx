// src/components/VoiceBot.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition.js";
import { useSpeechSynthesis } from "../hooks/useSpeechSynthesis.js";
import { askLLMStream } from "../lib/llm.js";

function nowTime() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const LANGS = [
  { label: "English (US)", value: "en-US" },
  { label: "Spanish (Spain)", value: "es-ES" },
  { label: "Spanish (Mexico)", value: "es-MX" },
  { label: "French (France)", value: "fr-FR" },
  { label: "German (Germany)", value: "de-DE" },
  { label: "Italian (Italy)", value: "it-IT" },
  { label: "Portuguese (Brazil)", value: "pt-BR" },
  { label: "Japanese", value: "ja-JP" },
  { label: "Korean", value: "ko-KR" },
  { label: "Chinese (Simplified)", value: "zh-CN" },
];

export default function VoiceBot() {
  const sr = useSpeechRecognition();
  const tts = useSpeechSynthesis();

  const [textInput, setTextInput] = useState("");
  const [busy, setBusy] = useState(false);

  const browserLocale = useMemo(() => navigator.language || "en-US", []);

  const [settings, setSettings] = useState(() => ({
    autoSpeak: true,
    sttLang: browserLocale,
    ttsLang: browserLocale,
    voiceURI: "",
    rate: 1,
    pitch: 1,
    volume: 1,
  }));

  const [messages, setMessages] = useState(() => [
    {
      id: crypto.randomUUID(),
      role: "bot",
      time: nowTime(),
      content:
        "Hi! I’m your Voice Bot Engineer demo.\n\nStep F is live: streaming tokens + barge-in. Start Listening while I’m speaking to interrupt.",
    },
  ]);

  // Keep latest messages to avoid stale history during async streaming
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const speechStatus = useMemo(() => {
    if (!sr.supported) return { label: "STT not supported", tone: "warn" };
    if (sr.error) return { label: `STT error: ${sr.error}`, tone: "bad" };
    if (sr.listening) return { label: `Listening… (${settings.sttLang})`, tone: "good" };
    return { label: `Idle (${settings.sttLang})`, tone: "pill" };
  }, [sr.supported, sr.error, sr.listening, settings.sttLang]);

  const addMsg = (role, content) => {
    const msg = { id: crypto.randomUUID(), role, time: nowTime(), content };
    setMessages((prev) => [...prev, msg]);
    return msg.id;
  };

  // Update an existing message by id (used for streaming)
  const updateMsg = (id, patch) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const voiceOptions = useMemo(() => {
    if (!tts.supported) return [];
    const target = (settings.ttsLang || "").toLowerCase();
    const base = target.split("-")[0];
    const filtered = tts.voices.filter((v) => (v.lang || "").toLowerCase().startsWith(base));
    return filtered.length ? filtered : tts.voices;
  }, [tts.supported, tts.voices, settings.ttsLang]);

  const sendToLLM = async (userText) => {
    const clean = userText?.trim();
    if (!clean) return;

    setBusy(true);

    // Build deterministic history from the latest state
    const prev = messagesRef.current;
    const history = prev.map((m) => ({
      role: m.role === "bot" ? "assistant" : "user",
      content: m.content,
    }));

    // Add user message
    addMsg("user", clean);

    // Create a streaming bot bubble right away
    const botId = addMsg("bot", "");

    try {
      const locale = settings.sttLang || "en-US";

      let full = "";
      for await (const chunk of askLLMStream({
        userText: clean,
        history: [...history, { role: "user", content: clean }],
        locale,
      })) {
        full += chunk;
        updateMsg(botId, { content: full });
      }

      // Speak AFTER stream completes (best for demo stability)
      if (settings.autoSpeak && tts.supported) {
        tts.speak({
          text: full,
          voiceURI: settings.voiceURI || undefined,
          rate: Number(settings.rate),
          pitch: Number(settings.pitch),
          volume: Number(settings.volume),
          lang: settings.ttsLang || undefined, // if hook supports it, nice; otherwise ignored
        });
      }
    } catch (e) {
      updateMsg(botId, {
        content: "LLM stream failed. (This demo should not need any server or API key.)",
      });
    } finally {
      setBusy(false);
    }
  };

  const onSubmitTyped = async () => {
    const v = textInput;
    setTextInput("");
    await sendToLLM(v);
  };

  const commitSpeech = async () => {
    const speechText = (sr.finalText || sr.interim || "").trim();
    if (!speechText) return;
    sr.stop();
    await sendToLLM(speechText);
  };

  const clearChat = () => {
    tts.stop();
    sr.stop();
    sr.reset();
    setTextInput("");
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "bot",
        time: nowTime(),
        content:
          "Chat cleared. Try: “Explain barge-in”, “Design a Twilio call flow”, or speak Spanish/Japanese and watch the reply language.",
      },
    ]);
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="card-h">
          <strong>Conversation</strong>
          <div className="row">
            <span className={`pill ${speechStatus.tone === "good" ? "btn-good" : ""}`}>
              {speechStatus.label}
            </span>
            <button className="btn" onClick={clearChat} disabled={busy}>
              Clear
            </button>
          </div>
        </div>

        <div className="card-b">
          <div className="chat" aria-label="chat">
            {messages.map((m) => (
              <div key={m.id} className={`msg ${m.role === "user" ? "user" : "bot"}`}>
                <div className="meta">
                  <span className="mono">{m.role.toUpperCase()}</span>
                  <span className="mono">{m.time}</span>
                </div>
                <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{m.content}</div>
              </div>
            ))}
          </div>

          <div className="hr" />

          <div className="kv">
            <div>
              <div className="label">Type a message</div>
              <textarea
                rows={3}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder='e.g., "How do you handle barge-in?"'
                disabled={busy}
              />
              <div className="row" style={{ marginTop: 10 }}>
                <button
                  className="btn btn-primary"
                  onClick={onSubmitTyped}
                  disabled={busy || !textInput.trim()}
                >
                  Send
                </button>
                <button className="btn" onClick={() => setTextInput("")} disabled={busy || !textInput}>
                  Reset
                </button>
                {tts.supported && (
                  <button className="btn" onClick={tts.stop} disabled={!tts.speaking}>
                    Stop Speaking
                  </button>
                )}
              </div>
            </div>

            <div>
              <div className="label">Voice input (STT)</div>

              <div className="row" style={{ gap: 10, alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <div className="label">STT language</div>
                  <select
                    value={settings.sttLang}
                    onChange={(e) => setSettings((s) => ({ ...s, sttLang: e.target.value }))}
                    disabled={!sr.supported || busy || sr.listening}
                  >
                    {LANGS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label} — {l.value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="toast" style={{ marginTop: 10 }}>
                <div className="small">
                  <div>
                    <span className="mono">interim:</span> {sr.interim || "—"}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span className="mono">final:</span> {sr.finalText || "—"}
                  </div>
                </div>
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                <button
                  className="btn btn-good"
                  onClick={() => {
                    // BARGE-IN: if bot is speaking, stop immediately
                    if (tts.speaking) tts.stop();
                    sr.start({ lang: settings.sttLang });
                  }}
                  disabled={!sr.supported || sr.listening || busy}
                >
                  Start Listening
                </button>
                <button
                  className="btn btn-warn"
                  onClick={sr.stop}
                  disabled={!sr.supported || !sr.listening}
                >
                  Stop
                </button>
                <button
                  className="btn btn-primary"
                  onClick={commitSpeech}
                  disabled={busy || (!sr.finalText && !sr.interim)}
                >
                  Send Speech
                </button>
              </div>

              {!sr.supported && (
                <div className="small" style={{ marginTop: 10 }}>
                  Your browser doesn’t expose SpeechRecognition. Chrome usually works best.
                </div>
              )}
              {sr.error && (
                <div className="small" style={{ marginTop: 10, color: "var(--bad)" }}>
                  STT error: {sr.error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <strong>Settings</strong>
          <span className="pill mono">{busy ? "LLM busy…" : "ready"}</span>
        </div>

        <div className="card-b">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="small">Text-to-speech</span>
            <span className="pill mono">{tts.supported ? "TTS supported" : "TTS not supported"}</span>
          </div>

          <div className="hr" />

          <label className="row" style={{ justifyContent: "space-between" }}>
            <span className="small">Auto-speak bot replies</span>
            <input
              type="checkbox"
              checked={settings.autoSpeak}
              onChange={(e) => setSettings((s) => ({ ...s, autoSpeak: e.target.checked }))}
              style={{ width: 18, height: 18 }}
              disabled={!tts.supported}
            />
          </label>

          <div className="kv" style={{ marginTop: 12 }}>
            <div>
              <div className="label">TTS language</div>
              <select
                value={settings.ttsLang}
                onChange={(e) => setSettings((s) => ({ ...s, ttsLang: e.target.value, voiceURI: "" }))}
                disabled={!tts.supported}
              >
                {LANGS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label} — {l.value}
                  </option>
                ))}
              </select>
              <div className="small" style={{ marginTop: 6 }}>
                Voice list is filtered to match this language (when possible).
              </div>
            </div>

            <div>
              <div className="label">Voice</div>
              <select
                value={settings.voiceURI}
                onChange={(e) => setSettings((s) => ({ ...s, voiceURI: e.target.value }))}
                disabled={!tts.supported}
              >
                <option value="">Default</option>
                {voiceOptions.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="kv" style={{ marginTop: 12 }}>
            <div>
              <div className="label">Rate</div>
              <input
                type="number"
                min="0.6"
                max="1.4"
                step="0.1"
                value={settings.rate}
                onChange={(e) => setSettings((s) => ({ ...s, rate: e.target.value }))}
                disabled={!tts.supported}
              />
            </div>
            <div>
              <div className="label">Pitch</div>
              <input
                type="number"
                min="0.6"
                max="1.6"
                step="0.1"
                value={settings.pitch}
                onChange={(e) => setSettings((s) => ({ ...s, pitch: e.target.value }))}
                disabled={!tts.supported}
              />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="label">Volume</div>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={settings.volume}
              onChange={(e) => setSettings((s) => ({ ...s, volume: e.target.value }))}
              disabled={!tts.supported}
            />
          </div>

          <div className="hr" />

          <div className="small">
           Real-time voice interactions with interruption support are enabled. Optional upgrades include optimized speech buffering and analytics instrumentation.          </div>
        </div>
      </div>
    </div>
  );
}
