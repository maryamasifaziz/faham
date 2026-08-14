# **Faham — فہم · Har English document, aap ki zaban mein**

**Faham** ("understanding" in Urdu) solves a real, everyday Pakistani problem: the most
important documents of daily life — electricity bills, bank letters, visa decisions,
rent agreements, traffic challans, medical forms — come in **English**, but a large part
of Pakistan reads Urdu, Roman-Urdu, or faces low English literacy.

Paste any document or text — **or upload a photo/PDF of a bill or letter** — → Faham returns:
1. **A simple Urdu summary** (plain, casual, no bureaucracy) — rendered right-to-left in Nastaliq.
2. **The same summary in Roman Urdu** for Urdu-latin readers.
3. **Key facts as cards** — amounts, due dates, deadlines, penalties, contact info, actions needed.

**Modes:** Explain a document (bill / bank / legal / forms) · Translate English → Urdu ·
Roman Urdu → Nastaliq · Summarize long content in simple Urdu.

Uploads read **natively (no OCR needed)**: images (`PNG`, `JPEG`, `WebP`, `BMP`) and **PDFs** are
sent straight to Gemini's vision; the full document is then explained section by section in detail,
citing the actual figures on it.

> Made for the AI Seekho hackathon · 14 August. Runs on Google Gemini's free tier.

## Try it live

**https://faham-rho.vercel.app** — deployed on Vercel, no install needed.

---

## Quickstart

```bash
cd faham
npm install

# 1) Add your free Gemini API key
copy .env.example .env   # then edit .env: GEMINI_API_KEY=your_key_here
# OR skip this: paste the key inside the web app's Settings tab instead

# 2) Run
npm start
```

Open **http://localhost:3000**, click a sample document (or paste your own), press
**فہم کریں**.

## Sample documents (try it instantly)

Drag any of these into the app's **upload box** (or use them in a demo/pitch):

| Sample | File | What it demonstrates |
|---|---|---|
| K-Electric bill (photo) | `samples/KElectric-Bill.jpg` | Real scan of an electricity bill — amounts, due date, disconnection warning |
| Alfalah auto loan (photo) | `samples/Alfalah-Auto-Loan.jpg` | Real bank/auto-loan document — loan terms, instalments |
| NBP salary loan (photo) | `samples/NBP-Salary-Loan.png` | Real bank salary-loan form |
| Traffic challan (photo) | `samples/Traffic-Challan.jpg` | Real fine — penalty amount, 50% discount deadline |
| Bank loan letter | `samples/bank-loan-letter.jpg` | Loan amount, interest %, monthly instalment, deadline |
| Traffic challan (clean) | `samples/traffic-challan.png` | Fine amount, payment deadline, 50% discount rule |

> The first four are real documents — use the two dummy ones if you don't want
> to share personal details in a demo.

> No key set up? Click ⚙️ → paste a free key from https://aistudio.google.com/apikey
> (stored only in your browser's localStorage).

## Deployment

**Live now:** Vercel → `https://faham-rho.vercel.app`. Every push to `main` auto-deploys;
`vercel.json` routes `/api/*` to `api/index.js` (the express app), and the `GEMINI_API_KEY`
environment variable is set in the Vercel project dashboard (Settings → Environment Variables).

### Alternative: Deploy on Render (free, no credit card)

1. Push this folder to a GitHub repo (e.g. `faham`).
2. On [render.com](https://render.com) → **New → Web Service** → connect the repo.
3. Render auto-detects [`render.yaml`](render.yaml) (Blueprint) → **Apply**.
4. In the service's **Environment**, set `GEMINI_API_KEY` to a free key from
   https://aistudio.google.com/apikey.
5. Deploy, then open the `https://faham.onrender.com` URL.

> Free tier sleeps after ~15 min idle and wakes in ~50 s on first visit — reopen the
> page a minute before demoing. Even without an env key, anyone can still paste a key
> in ⚙️ Settings and use it instantly.

## What's inside

| File | Purpose |
|---|---|
| `server.js` | Express server; proxies a single request to the Gemini API and asks for strict JSON. |
| `public/index.html` | One-page UI: paste box, upload box (photo/PDF), sample docs, Urdu/Roman-Urdu toggle, key-facts cards, WhatsApp share. |
| `public/style.css` | Pakistan-green theme, mobile-first, Noto Nastaliq Urdu font. |
| `public/app.js` | Fetch, render, copy/share, settings persistence; client-side image downscaling for uploads. |
| `samples/` | Sample bills & letters (PNG/JPG) for demoing / testing the upload flow. |

## Architecture (why this is demo-proof)

- **No build step, no framework** — static files + one small Node server. Ships instantly.
- **Photo/PDF upload (no OCR needed)** — point your camera at any bill; Gemini vision reads
  images and PDFs natively and explains the whole document section-by-section.
- **Key facts are extracted as structured data**, not just prose — great for judges
  ("functionality") and for future features (SMS/Dashboard integrations).
- **Key-fact cards are bilingual too** — each fact flips between Urdu and Roman Urdu
  (labels + values) with the same toggle as the summary, so low-literacy readers aren't
  left with English-only figures.
- **Roman-Urdu dual output** shows accessibility thinking — real product depth.
- **WhatsApp share** is native to how Pakistanis actually share important info.

## Future / scale-up ideas (post-hackathon)

- **SMS/USSD mode** for feature-phone users (the biggest underserved segment).
- **Voice in / voice out** (Urdu TTS + speech input via browser Web Speech API).
- **Government form auto-fill** — detect form fields, pre-fill from scanned NIC/IDs.
- **Offline glossary** cache for no-network clinics and bazaars.
- **Dashboard analytics** for partners (banks, K-Electric, NADRA) to see comprehension gaps.

## Pitch one-liner

> *Every Pakistani government office, bank, and utility writes in English.
> Ordinary people sign what they don't understand. Faham turns those documents into
> simple Urdu — so every citizen actually* **فہم**s *what they're agreeing to.*
