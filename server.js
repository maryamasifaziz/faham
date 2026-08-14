require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const JSON_CONTRACT = `Respond ONLY with valid JSON in this exact shape (no markdown, no code fences):
{
  "urduSummary": "the Urdu output, formatted with line breaks for readability; if not applicable put an empty string",
  "romanUrdu": "the same output in Roman Urdu (Urdu written in English letters); if not applicable put an empty string",
  "keyFacts": [
    { "label": "short English label like 'Amount Due' / 'Due Date' / 'Action Needed'", "value": "the extracted value in plain Urdu or as-is", "type": "amount|date|deadline|action|contact|other" }
  ]
}
Every keyFacts item must have all three fields. If a category is absent, omit it. Never invent numbers.`;

const MODE_INSTRUCTIONS = {
  document:
    `MODE: document. You are "Faham", a Pakistani assistant that makes English documents easy for ordinary Pakistanis.
The user gives an English document (bill, bank letter, legal notice, visa letter, tenancy agreement, traffic challan, etc.).
1. urduSummary: a SHORT, SIMPLE Urdu summary of what the document says and what the reader must do. Casual, plain Urdu, no complex words, no bureaucracy.
2. romanUrdu: the same summary in Roman Urdu.
3. keyFacts: extract amounts (Rs or other currency), dates, deadlines, due dates, actions required, penalties, contact info.`,
  translate:
    `MODE: translate. Translate the user's English text into clear, natural Urdu.
1. urduSummary: the full Urdu translation.
2. romanUrdu: the same translation in Roman Urdu.
3. keyFacts: empty array ([]) unless there are genuinely important numbers/deadlines, in which case include them.`,
  roman:
    `MODE: roman-to-urdu. The user pastes Roman Urdu (Urdu written in English letters, as people type it on phones).
1. urduSummary: convert it to proper Urdu script (Nastaliq), cleanly spelled.
2. romanUrdu: the same text in tidy, standardized Roman Urdu.
3. keyFacts: empty array ([]).`,
  summarize:
    `MODE: summarize. The user pastes long English or Urdu content (news, article, message, lecture).
1. urduSummary: a SHORT, SIMPLE Urdu summary (3-6 sentences) of the main point.
2. romanUrdu: the same short summary in Roman Urdu.
3. keyFacts: include only genuinely important numbers, dates, or names, otherwise empty array ([]).`,
};

function buildPrompt(text, audienceHint, mode) {
  const modeInstructions = MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.document;
  return `${modeInstructions}

${JSON_CONTRACT}

--------- TEXT START ---------
${text}
--------- TEXT END ---------

Audience hint: ${audienceHint || "general household reader"}`;
}

function statusError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

async function readBody(res) {
  let body = "";
  try {
    body = await res.text();
  } catch {}
  return body;
}

function describeApiError(prefix, res, body) {
  let msg = `${prefix}: `;
  try {
    const json = JSON.parse(body);
    msg += json?.error?.message || body.slice(0, 300);
  } catch {
    msg += body.slice(0, 300);
  }
  return msg;
}

function extractOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text) return data.output_text;
  if (typeof data?.outputText === "string" && data.outputText) return data.outputText;

  if (Array.isArray(data?.outputs)) {
    const t = data.outputs.map((o) => (typeof o === "string" ? o : o?.text || "")).join("");
    if (t) return t;
  }

  if (Array.isArray(data?.steps)) {
    const t = data.steps
      .filter((s) => ["model_output", "output"].includes(s?.type))
      .map((s) =>
        Array.isArray(s?.content)
          ? s.content.filter((c) => !c || c.type === "text").map((c) => c?.text || "").join("")
          : ""
      )
      .join("");
    if (t) return t;
  }

  if (Array.isArray(data?.candidates)) {
    const t = data.candidates
      .map((c) => c?.content?.parts?.map((p) => p?.text || "").join("") || "")
      .join("");
    if (t) return t;
  }

  return "";
}

function parseOutput(textPart) {
  try {
    return JSON.parse(textPart.replace(/^```json\s*/, "").replace(/```$/, "").trim());
  } catch (e) {
    return { raw: textPart };
  }
}

// Interactions API (2026-era, recommended by Google)
async function interactionCall(apiKey, model, prompt) {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
      "Api-Revision": "2026-05-20",
    },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      model,
      input: prompt,
      generation_config: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    const body = await readBody(res);
    throw statusError(describeApiError(`Interactions API error ${res.status} (${model})`, res, body), res.status);
  }

  const text = extractOutputText(await res.json());
  if (!text) throw statusError(`Empty response from Gemini (${model})`, 502);
  return text;
}

// Legacy generateContent fallback (still supported)
async function generateContentCall(apiKey, model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const body = await readBody(res);
    throw statusError(describeApiError(`Gemini API error ${res.status} (${model})`, res, body), res.status);
  }

  const text = extractOutputText(await res.json());
  if (!text) throw statusError(`Empty response from Gemini (${model})`, 502);
  return text;
}

async function callGemini(apiKey, text, audienceHint, mode) {
  const prompt = buildPrompt(text, audienceHint, mode);
  const FATAL = [401, 403, 429];
  let lastMsg = "All Gemini endpoints returned an error.";

  const interactionModels = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash"];
  const legacyModels = ["gemini-2.5-flash", "gemini-2.0-flash"];

  for (const model of interactionModels) {
    try {
      return parseOutput(await interactionCall(apiKey, model, prompt));
    } catch (err) {
      if (FATAL.includes(err.status)) throw err;
      lastMsg = err.message;
    }
  }

  for (const model of legacyModels) {
    try {
      return parseOutput(await generateContentCall(apiKey, model, prompt));
    } catch (err) {
      if (FATAL.includes(err.status)) throw err;
      lastMsg = err.message;
    }
  }

  throw statusError(lastMsg, 502);
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    hasEnvKey: Boolean(process.env.GEMINI_API_KEY),
    model: GEMINI_MODEL,
  });
});

app.post("/api/faham", async (req, res) => {
  const text = (req.body?.text || "").trim();
  const audienceHint = (req.body?.audienceHint || "").trim();
  const clientKey = (req.body?.apiKey || "").trim();
  const mode = (req.body?.mode || "document").trim();
  if (!["document", "translate", "roman", "summarize"].includes(mode)) {
    return res.status(400).json({ error: "Unknown mode." });
  }

  const apiKey = clientKey || process.env.GEMINI_API_KEY;
  if (!text) return res.status(400).json({ error: "No document text provided." });
  if (text.length < 20) {
    return res.status(400).json({ error: "Document looks too short - add the full text." });
  }
  if (text.length > 12000) {
    return res.status(400).json({ error: "Document is too long for the free demo (max ~12,000 chars)." });
  }
  if (!apiKey) {
    return res.status(400).json({
      error: "No Gemini API key configured. Add one in the Settings tab, or set GEMINI_API_KEY in the .env file.",
    });
  }

  try {
    const result = await callGemini(apiKey, text, audienceHint, mode);
    res.json({ ok: true, result });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Faham running at http://localhost:${PORT}`);
  });
}

module.exports = app;