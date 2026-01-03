// src/lib/llm.js
// LOCAL MOCK w/ STREAMING (NO fetch, NO server, NO keys)

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeLang(locale) {
  const raw = (locale || "en-US").toLowerCase();
  const lang = raw.split("-")[0];
  return lang === "es" ? "es" : "en";
}

function resumeStyleAnswer(userText, lang = "en") {
  const safeText = (userText || "").trim() || "(empty)";

  if (lang === "es") {
    const templates = [
      "Así lo haría en un bot de voz de producción: (1) intención + entidades, (2) confirmar datos críticos, (3) herramientas/APIs, (4) respuesta corta para TTS, (5) trazas + transcripciones.",
      "Para atención al cliente: barge-in, reintentos, umbrales de confianza, y fallback a agente humano.",
      "UX de voz en web: respuestas cortas, dividir contenido largo, mostrar transcripción, y botón de “Detener”.",
    ];
    const extras = [
      "Detalle: reproducir TTS por bloques para reducir latencia percibida.",
      "Seguridad: redactar PII en logs y evitar hablar datos sensibles.",
      "Observabilidad: STT_START, STT_FINAL, LLM_REQUEST, LLM_LATENCY_MS, TTS_START/END.",
    ];
    return `${pick(templates)}\n\nDijiste: “${safeText}”\n\n${pick(extras)}`;
  }

  const templates = [
    "Here’s how I’d approach that in a production voice bot: (1) detect intent + entities, (2) confirm critical slots, (3) call tools/APIs, (4) speak a concise response, (5) log traces + transcripts for QA.",
    "For customer-service voice flows: add barge-in handling, retry prompts, confidence thresholds, and a fallback to agent handoff.",
    "For web voice UX: keep replies short, chunk long answers, show transcript, and provide a visible “Stop speaking” control.",
  ];

  const extras = [
    "Implementation detail: stream partial responses to the UI while TTS is playing to reduce perceived latency.",
    "Safety: redact PII in logs + add a policy layer to prevent sensitive content from being spoken aloud.",
    "Observability: emit events like STT_START, STT_FINAL, LLM_REQUEST, LLM_LATENCY_MS, TTS_START/END.",
  ];

  return `${pick(templates)}\n\nYou said: “${safeText}”\n\n${pick(extras)}`;
}

// STREAM: yields text chunks (for “typing” UX)
export async function* askLLMStream({ userText, history, locale }) {
  const lang = normalizeLang(locale);
  const full = resumeStyleAnswer(userText, lang);

  // simulate latency + chunking
  const parts = full.split(/(\s+)/); // keep spaces so it reads naturally
  for (let i = 0; i < parts.length; i++) {
    await new Promise((r) => setTimeout(r, 18)); // “typing” speed
    yield parts[i];
  }
}

// Non-stream fallback (keeps older call sites working)
export async function askLLM({ userText, history, locale }) {
  let out = "";
  for await (const chunk of askLLMStream({ userText, history, locale })) out += chunk;
  return out;
}
