const $ = (id) => document.getElementById(id);

const KEY_STORE = "faham.apiKey";
const audienceEl = $("audience");
const modeEl = $("mode");
const docEl = $("docText");
const charEl = $("charCount");
const errorEl = $("errorBox");
const resultEl = $("resultCard");
const loadingEl = $("loading");
const loadingMsgEl = $("loadingMsg");

const SAMPLES = {
  bill:
    "K-Electric | MONTHLY BILL — AUGUST 2026\n" +
    "Consumer Name: Ahmed Raza\n" +
    "Reference No: 04213-2381178-9\n" +
    "Current Charges: Rs 12,450 | Arrears: Rs 1,200\n" +
    "DUE DATE: 25-08-2026\n" +
    "PAY ONLINE at www.ke.com.pk/pay or any UBL / HBL branch.\n" +
    "If you do not pay by the due date, a late-payment surcharge of Rs 500 will apply, and after 60 days the connection may be disconnected. For queries call 118.",
  loan:
    "State Bank Approved | LENDING LETTER — Loan Account No. 40291\n" +
    "Dear Mr. Bilal Khan,\n" +
    "We are pleased to inform you that your personal loan of Rs 500,000 has been approved at a mark-up rate of 9.5% per annum.\n" +
    "Your first monthly instalment of Rs 15,300 is due on the 10th of every month, starting 10-09-2026. Payment can be made via bank transfer or at any branch.\n" +
    "Please note: if an instalment is missed, a penalty of Rs 1,500 will be charged and your credit rating may be affected.\n" +
    "For assistance call our helpline 021-111-000-222.",
  visa:
    "DECISION ON APPLICATION FOR UK VISA — Reference: GWF123456\n" +
    "Applicant: Ms. Sana Fatima | Date of decision: 02-08-2026\n" +
    "This is to inform you that your application for a Standard Visitor visa has been REFUSED.\n" +
    "Your application did not satisfy the Immigration Rules because the evidence you provided does not show sufficient ties to your home country and financial standing.\n" +
    "You have the right to request a review of this decision within 28 days of the date of this notice, to which an administrative review fee of GBP 154.00 applies. If you wish to re-apply, you must submit a new application and pay the application fee again.",
  rent:
    "RENTAL AGREEMENT EXCERPTS\n" +
    "This tenancy agreement is between Mr. Javed Anwar (Landlord) and Mr. Usman Malik (Tenant) for the property at House 14-B, Street 8, F-7/3, Islamabad.\n" +
    "1. Monthly rent is Rs 85,000 (eighty-five thousand rupees).\n" +
    "2. Rent is payable on or before the 5th of each month.\n" +
    "3. Security deposit of Rs 170,000 has been paid, refundable within 30 days of vacating, less any damages.\n" +
    "4. Either party must give 2 months written notice to end the tenancy.\n" +
    "5. Electricity and water bills are to be paid by the tenant.\n" +
    "This agreement is valid for 12 months starting 01-08-2026.",
  fine:
    "PENALTY CHALLAN — Islamabad Traffic Police\n" +
    "Challan No: 7742091 | Date: 12-08-2026\n" +
    "Violation: Driving on mobile phone (Section 44-A) | Vehicle: (private) LEC-2810\n" +
    "Amount: Rs 4,000\n" +
    "Pay within 15 days at JazzCash (ID 84721), Easypaisa, or the nearest traffic police challan counter to receive a 50% discount.\n" +
    "If not paid within 30 days, a hearing notice will be issued and penalty may double.",
};

Object.entries(SAMPLES).forEach(([key, text]) => {
  document.querySelector(`[data-sample="${key}"]`)?.addEventListener("click", () => {
    setMode("document");
    docEl.value = text;
    docEl.focus();
    updateCount();
    errorEl.hidden = true;
  });
});

const MODE_PLACEHOLDER = {
  document: "Paste your electricity bill, bank loan letter, visa notice, or traffic challan here...",
  translate: "Paste English text to translate into fluent Nastaliq Urdu (e.g. 'Your passport application has been dispatched...')...",
  roman: "Paste Roman Urdu message (e.g. 'aaj shaam ko bank manager se meeting hai, documents sath le aana')...",
  summarize: "Paste a long rental agreement, bank terms, or news article to get 3 bullet points in simple Urdu...",
};

const MODE_LOADING_MSG = {
  document: "📄 Reading your document & extracting key facts...",
  translate: "🌐 Translating into simple Nastaliq Urdu...",
  roman: "🔤 Converting Roman Urdu to Nastaliq...",
  summarize: "📝 Summarizing document into key points...",
};

function setMode(selectedMode) {
  modeEl.value = selectedMode;
  document.querySelectorAll(".mode-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.mode === selectedMode);
  });
  applyMode();
}

document.querySelectorAll(".mode-tab").forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

function applyMode() {
  const mode = modeEl.value;
  document.querySelectorAll(".mode-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.mode === mode);
  });
  const hints = document.querySelectorAll(".samples");
  hints.forEach((h) => (h.style.display = mode === "document" ? "" : "none"));
  if (!docEl.value) docEl.placeholder = MODE_PLACEHOLDER[mode] || "";
}
modeEl.addEventListener("change", applyMode);
applyMode();

function updateCount() {
  charEl.textContent = `${docEl.value.length} chars`;
}
docEl.addEventListener("input", updateCount);
updateCount();

/* ---------- Settings modal ---------- */
const modal = $("settingsModal");
const scrim = $("scrim");
$("btnSettings").addEventListener("click", openSettings);
$("btnCloseSettings").addEventListener("click", closeSettings);
scrim.addEventListener("click", closeSettings);

function openSettings() {
  modal.hidden = false;
  scrim.hidden = false;
  $("apiKeyInput").value = localStorage.getItem(KEY_STORE) || "";
  $("keyStatus").textContent = "";
}
function closeSettings() {
  modal.hidden = true;
  scrim.hidden = true;
}

$("btnSaveKey").addEventListener("click", () => {
  const key = $("apiKeyInput").value.trim();
  if (key) localStorage.setItem(KEY_STORE, key);
  else localStorage.removeItem(KEY_STORE);
  $("keyStatus").textContent = key ? "Saved ✔ (stored in this browser only)" : "Key removed.";
  setTimeout(closeSettings, 900);
});

/* ---------- Submit ---------- */
const btnFaham = $("btnFaham");
btnFaham.addEventListener("click", run);

async function run() {
  const text = docEl.value.trim();
  const audienceHint = audienceEl.value;
  const mode = modeEl.value;
  const apiKey = localStorage.getItem(KEY_STORE) || "";

  errorEl.hidden = true;
  if (text.length < 20) {
    showError("Please paste the full text (at least a few sentences).");
    return;
  }

  if (loadingMsgEl) {
    loadingMsgEl.textContent = MODE_LOADING_MSG[mode] || "Reading your document...";
  }

  btnFaham.disabled = true;
  loadingEl.hidden = false;

  try {
    const res = await fetch("/api/faham", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, audienceHint, apiKey, mode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    render(data.result);
  } catch (err) {
    showError(err.message);
  } finally {
    btnFaham.disabled = false;
    loadingEl.hidden = true;
  }
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

/* ---------- Render ---------- */
let lastSummary = "";

const TYPE_ICONS = {
  amount: "💰",
  deadline: "⏰",
  date: "📅",
  action: "⚡",
  contact: "📞",
  other: "📌",
};

function render(r) {
  resultEl.hidden = false;
  if (r.raw) {
    $("summaryUrdu").textContent = r.raw;
    $("summaryRoman").textContent = r.raw;
    $("facts").innerHTML = "";
    switchView("urdu");
    return;
  }

  $("summaryUrdu").textContent = r.urduSummary || r.romanUrdu || "—";
  $("summaryRoman").textContent = r.romanUrdu || r.urduSummary || "—";
  lastSummary = r.urduSummary || r.romanUrdu || "";

  const factsEl = $("facts");
  factsEl.innerHTML = "";
  const facts = Array.isArray(r.keyFacts) ? r.keyFacts : [];
  const factsBlock = document.querySelector(".facts-block");
  factsBlock.style.display = facts.length ? "" : "none";
  facts.forEach((f) => {
    const type = ["amount", "date", "deadline", "action", "contact", "other"].includes(f.type) ? f.type : "other";
    const icon = TYPE_ICONS[type] || "📌";
    const div = document.createElement("div");
    div.className = `fact type-${type}`;
    const label = document.createElement("span");
    label.className = "flabel";
    label.innerHTML = `<span class="fact-icon">${icon}</span> ${f.label || "Note"}`;
    const value = document.createElement("span");
    value.className = "fvalue";
    value.textContent = f.value || "";
    div.append(label, value);
    factsEl.appendChild(div);
  });

  switchView("urdu");
  resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
}

function switchView(view) {
  const urdu = $("summaryUrdu");
  const roman = $("summaryRoman");
  urdu.style.display = view === "urdu" ? "" : "none";
  roman.style.display = view === "roman" ? "" : "none";
  document.querySelectorAll(".toggle").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
  });
}

document.querySelectorAll(".toggle").forEach((b) =>
  b.addEventListener("click", () => switchView(b.dataset.view))
);

void audienceEl;

/* ---------- Result actions ---------- */
$("btnCopy").addEventListener("click", async () => {
  const text = lastSummary;
  try {
    await navigator.clipboard.writeText(text);
    flash($("btnCopy"), "Copied ✔");
  } catch {
    flash($("btnCopy"), "Select & copy manually");
  }
});

function flash(btn, msg) {
  const old = btn.textContent;
  btn.textContent = msg;
  setTimeout(() => (btn.textContent = old), 1400);
}

function encodeMsg(s) {
  return encodeURIComponent(s).replace(/%20/g, "%20");
}

$("btnWhatsApp").addEventListener("click", () => {
  const url = `https://wa.me/?text=${encodeMsg("فہم سمجھاؤ | Faham summary:\n\n" + lastSummary)}`;
  window.open(url, "_blank");
});