import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function systemPromptForLocale(locale) {
  // Keep it simple: reply in the same language the user used / selected.
  // locale examples: en-US, es-ES, ja-JP
  const lang = (locale || "en-US").split("-")[0];

  return `
You are a Voice Bot Engineer interview demo.
- Reply in the user's language (locale hint: ${locale || "en-US"}).
- Be concise and spoken-audio friendly (short paragraphs, minimal jargon).
- If user asks for architecture, give numbered steps.
- If user asks for code, give minimal code plus explanation.
Language hint: ${lang}
`.trim();
}

app.post("/api/voicebot", async (req, res) => {
  try {
    const { userText, history = [], locale = "en-US" } = req.body || {};
    if (!userText || typeof userText !== "string") {
      return res.status(400).json({ error: "Missing userText" });
    }

    // Map your history into “input” for Responses API.
    // We’ll keep it straightforward: one system message + conversation turns.
    const input = [
      { role: "system", content: systemPromptForLocale(locale) },
      ...history.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || ""),
      })),
      { role: "user", content: userText },
    ];

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input,
    });

    // Extract text output
    // (Responses can contain multiple items; the SDK normalizes outputs.)
    const answer =
      response.output_text ||
      "No text returned (unexpected).";

    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error calling OpenAI.");
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`VoiceBot server on http://localhost:${port}`));
