require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

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

async function callGemini(apiKey, text, audienceHint, mode) {
  const models = ["gemini-1.5-flash", "gemini-1.5-pro"];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: buildPrompt(text, audienceHint, mode),
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2048,
            responseMimeType: "application/json",
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const textPart = data?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || "")
          .join("");
        if (!textPart) throw new Error("Empty response from Gemini");

        try {
          return JSON.parse(textPart.replace(/^```json\s*/, "").replace(/```$/, "").trim());
        } catch (e) {
          return { raw: textPart };
        }
      }

      let body = "";
      try {
        body = await res.text();
      } catch {}

      let errMessage = `Gemini API error (${model}): `;
      try {
        const json = JSON.parse(body);
        errMessage += json?.error?.message || body.slice(0, 250);
      } catch {
        errMessage += body.slice(0, 250);
      }

      lastError = new Error(errMessage);
      lastError.status = res.status;

      // Stop immediately on authentication, permission, or quota errors
      if ([400, 401, 403, 429].includes(res.status)) {
        throw lastError;
      }
    } catch (err) {
      if ([400, 401, 403, 429].includes(err.status)) {
        throw err;
      }
      lastError = err;
    }
  }

  throw lastError || new Error("Gemini API request failed");
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