"use strict";
/* ============================================================
   Servidor local: sirve la página y expone /api/financials.
   - Fuente 1: SEC EDGAR (companyfacts XBRL). No requiere API key,
     pero la SEC exige un User-Agent con tu contacto: SEC_CONTACT.
   - Fuente 2 (respaldo): catálogo local data.js (PDF de EMIS / 20-F).
   Uso:  SEC_CONTACT="Tu Nombre tucorreo@dominio.com" node server.js
   Requiere Node 18 o superior. Sin dependencias.
   ============================================================ */
const http = require("http"), fs = require("fs"), path = require("path"), vm = require("vm");

const PORT = Number(process.env.PORT) || 3000;
const CONTACT = (process.env.SEC_CONTACT || "").trim();
const EDGAR_BASE = process.env.EDGAR_BASE || "https://data.sec.gov";
const TICKERS_URL = process.env.TICKERS_URL || "https://www.sec.gov/files/company_tickers.json";
const CACHE_DIR = path.join(__dirname, "cache");
const LOCAL_ONLY = new Set(["SURENCO", "BKRCO", "HALCO", "GUACAM"]);   // privadas colombianas: no están en la SEC
const ANTHROPIC_KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const ANTHROPIC_URL = process.env.ANTHROPIC_URL || "https://api.anthropic.com/v1/messages";
const FORMS = new Set(["10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A"]);

/* ---------- catálogo local ---------- */
function loadCatalog() {
  const sandbox = {}; sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "data.js"), "utf8"), sandbox);
  return { catalog: sandbox.FIN_CATALOG || {}, aliases: sandbox.FIN_ALIASES || {} };
}

/* ---------- SEC: peticiones con límite y caché en disco ---------- */
let lastCall = 0;
async function secGet(url, ttlMs, cacheName) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, cacheName);
  try { if (Date.now() - fs.statSync(file).mtimeMs < ttlMs) return JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) {}
  if (!CONTACT) throw httpError(503, "Falta SEC_CONTACT: la SEC exige un User-Agent con tu nombre y correo.");
  const wait = Math.max(0, lastCall + 150 - Date.now());   // ~6 peticiones/s, por debajo del límite de 10/s
  lastCall = Date.now() + wait;
  if (wait) await new Promise((r) => setTimeout(r, wait));
  const res = await fetch(url, { headers: { "User-Agent": "MarketIntelligenceApp " + CONTACT, Accept: "application/json" } });
  if (!res.ok) throw httpError(res.status === 404 ? 404 : 502, "La SEC respondió " + res.status + " para " + url);
  const json = await res.json();
  fs.writeFileSync(file, JSON.stringify(json));
  return json;
}
function httpError(status, message) { const e = new Error(message); e.status = status; return e; }

async function tickerToCik(ticker) {
  const map = await secGet(TICKERS_URL, 7 * 864e5, "company_tickers.json");
  for (const k of Object.keys(map)) if (String(map[k].ticker).toUpperCase() === ticker) return { cik: String(map[k].cik_str).padStart(10, "0"), title: map[k].title };
  throw httpError(404, "La SEC no tiene el ticker " + ticker + ".");
}

/* ---------- normalizador de companyfacts ---------- */
const CONCEPTS = {
  sales: [["us-gaap", "Revenues"], ["us-gaap", "RevenueFromContractWithCustomerExcludingAssessedTax"], ["us-gaap", "RevenueFromContractWithCustomerIncludingAssessedTax"], ["us-gaap", "SalesRevenueNet"], ["ifrs-full", "Revenue"]],
  grossProfit: [["us-gaap", "GrossProfit"], ["ifrs-full", "GrossProfit"]],
  operatingIncome: [["us-gaap", "OperatingIncomeLoss"], ["ifrs-full", "ProfitLossFromOperatingActivities"]],
  netIncome: [["us-gaap", "NetIncomeLoss"], ["us-gaap", "ProfitLoss"], ["ifrs-full", "ProfitLoss"]],
  da: [["us-gaap", "DepreciationDepletionAndAmortization"], ["us-gaap", "DepreciationAndAmortization"], ["ifrs-full", "DepreciationAndAmortisationExpense"]],
  eps: [["us-gaap", "EarningsPerShareDiluted"], ["ifrs-full", "DilutedEarningsLossPerShare"]],
  cfo: [["us-gaap", "NetCashProvidedByUsedInOperatingActivities"], ["ifrs-full", "CashFlowsFromUsedInOperatingActivities"]],
  cfi: [["us-gaap", "NetCashProvidedByUsedInInvestingActivities"], ["ifrs-full", "CashFlowsFromUsedInInvestingActivities"]],
  cff: [["us-gaap", "NetCashProvidedByUsedInFinancingActivities"], ["ifrs-full", "CashFlowsFromUsedInFinancingActivities"]],
};
const BALANCE = {
  currentAssets: [["us-gaap", "AssetsCurrent"], ["ifrs-full", "CurrentAssets"]],
  totalAssets: [["us-gaap", "Assets"], ["ifrs-full", "Assets"]],
  currentLiabilities: [["us-gaap", "LiabilitiesCurrent"], ["ifrs-full", "CurrentLiabilities"]],
  totalLiabilities: [["us-gaap", "Liabilities"], ["ifrs-full", "Liabilities"]],
  totalEquity: [["us-gaap", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"], ["us-gaap", "StockholdersEquity"], ["ifrs-full", "Equity"]],
};
const DEBT_PARTS = [[["us-gaap", "LongTermDebtNoncurrent"], ["us-gaap", "LongTermDebt"], ["ifrs-full", "NoncurrentPortionOfNoncurrentBondsIssued"]],
                    [["us-gaap", "LongTermDebtCurrent"], ["us-gaap", "ShortTermBorrowings"], ["us-gaap", "DebtCurrent"]]];

/* Devuelve { year: {val, unit} } con datos anuales (10-K / 20-F / 40-F), el último filing por año.
   opts.instant: saldos al cierre (balance, sin fecha de inicio). opts.perShare: unidades por acción (EPS). */
function annual(facts, list, onlyUnit, opts) {
  opts = opts || {};
  const out = {};
  for (const [tax, name] of list) {
    const node = facts[tax] && facts[tax][name]; if (!node) continue;
    for (const unit of Object.keys(node.units)) {
      if (onlyUnit && !opts.perShare && unit !== onlyUnit) continue;
      if (opts.perShare ? !/\/shares/i.test(unit) : /shares|pure/i.test(unit)) continue;
      const best = {};
      for (const f of node.units[unit]) {
        if (!FORMS.has(f.form) || !f.end) continue;
        if (opts.instant) { if (f.start) continue; }
        else {
          if (!f.start) continue;
          const days = (Date.parse(f.end) - Date.parse(f.start)) / 864e5;
          if (days < 340 || days > 380) continue;
        }
        const y = Number(f.end.slice(0, 4));
        if (!best[y] || f.filed > best[y].filed) best[y] = { val: f.val, unit, filed: f.filed };
      }
      for (const y of Object.keys(best)) if (!out[y]) out[y] = best[y];   // prioridad: primer concepto con dato
    }
  }
  return out;
}

function normalize(companyfacts, ticker) {
  const facts = companyfacts.facts || {};
  const sales = annual(facts, CONCEPTS.sales);
  const years = Object.keys(sales).map(Number).sort((a, b) => a - b).slice(-5);
  if (!years.length) throw httpError(404, "No hay ingresos anuales (10-K/20-F) en XBRL para " + ticker + ".");
  const unit = sales[years[years.length - 1]].unit;
  const same = (k) => annual(facts, CONCEPTS[k], unit);
  const gp = same("grossProfit"), op = same("operatingIncome"), ni = same("netIncome");
  const big = unit === "COP";                       // COP: miles de millones; resto: millones
  const div = big ? 1e9 : 1e6, r = (v) => (v === undefined ? null : Math.round((v / div) * 1000) / 1000);
  const pick = (m) => years.map((y) => (m[y] && m[y].unit === unit ? r(m[y].val) : null));
  const inst = (k) => annual(facts, BALANCE[k], unit, { instant: true });
  const bal = {}; for (const k of Object.keys(BALANCE)) bal[k] = pick(inst(k));
  // Pasivos totales: si no vienen etiquetados, activos - patrimonio (calculado)
  bal.totalLiabilities = bal.totalLiabilities.map((v, i) => v !== null ? v : (bal.totalAssets[i] !== null && bal.totalEquity[i] !== null ? Math.round((bal.totalAssets[i] - bal.totalEquity[i]) * 1000) / 1000 : null));
  // Deuda financiera: suma de los conceptos disponibles (largo plazo + corriente)
  const dparts = DEBT_PARTS.map((list) => annual(facts, list, unit, { instant: true }));
  bal.totalDebt = years.map((y) => { const v = dparts.map((p) => (p[y] && p[y].unit === unit ? p[y].val : null)).filter((x) => x !== null); return v.length ? r(v.reduce((a, b) => a + b, 0)) : null; });
  const da = same("da"), eps = annual(facts, CONCEPTS.eps, unit, { perShare: true });
  const o = pick(op);
  return {
    ticker, name: companyfacts.entityName || ticker, currency: unit, unit: big ? "miles de millones" : "millones",
    source: "SEC EDGAR (companyfacts, XBRL), formularios 10-K/20-F, estados consolidados",
    years: years.map(String),
    sales: years.map((y) => r(sales[y].val)),
    grossProfit: pick(gp), operatingIncome: o, netIncome: pick(ni),
    ebitda: years.map((y, i) => (o[i] !== null && da[y] && da[y].unit === unit ? r(op[y].val + da[y].val) : null)),   // calculado: utilidad operacional + D&A
    eps: years.map((y) => (eps[y] ? Math.round(eps[y].val * 100) / 100 : null)),
    balance: bal,
    cashflow: { operating: pick(same("cfo")), investing: pick(same("cfi")), financing: pick(same("cff")) },
    via: "edgar",
  };
}

/* ---------- resolución de un ticker ---------- */
async function getFinancials(ticker, preferLocal) {
  const { catalog, aliases } = loadCatalog();
  const local = () => {
    const a = aliases[ticker], key = a ? a.to : ticker;
    return catalog[key] ? Object.assign({}, catalog[key], { notice: a ? a.notice : "", via: "catalogo" }) : null;
  };
  if (preferLocal || LOCAL_ONLY.has(ticker)) { const l = local(); if (l) return l; }
  try {
    const { cik } = await tickerToCik(ticker);
    return normalize(await secGet(EDGAR_BASE + "/api/xbrl/companyfacts/CIK" + cik + ".json", 12 * 36e5, "facts_" + cik + ".json"), ticker);
  } catch (err) {
    const l = local();
    if (l) { l.notice = ((l.notice || "") + " (No se pudo consultar la SEC: " + err.message + " Se muestran los datos del catálogo local.)").trim(); return l; }
    throw err;
  }
}


/* ---------- agente: borrador del informe con la API de Anthropic ---------- */
const DRAFT_SYSTEM = "Eres un analista financiero senior que redacta informes preliminares en español para una junta directiva. " +
  "Usa EXCLUSIVAMENTE las cifras que recibes en el JSON; no inventes cifras, segmentos, noticias, fechas ni citas. " +
  "Para oportunidades y amenazas formula hipótesis condicionadas a lo que muestran las cifras y márgenes (por ejemplo, 'si el margen operacional se recupera...'), sin afirmar hechos externos. " +
  "Si un dato falta, dilo. Responde SOLO con un objeto JSON válido, sin texto adicional ni bloques de código, con esta forma exacta: " +
  '{"summary": "2 párrafos separados por \\n\\n", "bull": ["4 ideas"], "bear": ["4 ideas"], "swot": {"s": ["3 ideas"], "w": ["3 ideas"], "o": ["3 ideas"], "t": ["3 ideas"]}}';

async function aiDraft(payload) {
  if (!ANTHROPIC_KEY) throw httpError(503, "La IA no está configurada: define ANTHROPIC_API_KEY en iniciar.bat y reinicia el servidor.");
  const d = payload.data || {};
  const body = { model: ANTHROPIC_MODEL, max_tokens: 2500, system: DRAFT_SYSTEM,
    messages: [{ role: "user", content: "Compañía: " + d.name + " (" + d.ticker + "). Moneda y unidad: " + d.currency + " " + d.unit + ". Fuente: " + d.source +
      ". Datos y métricas calculadas (JSON):\n" + JSON.stringify({ years: d.years, ingresos: d.sales, utilidadBruta: d.grossProfit, utilidadOperacional: d.operatingIncome, utilidadNeta: d.netIncome,
      ebitda: d.ebitda || null, eps: d.eps || null, balance: d.balance || null, flujoCaja: d.cashflow || null, senales: payload.signals || [] }) }] };
  const res = await fetch(ANTHROPIC_URL, { method: "POST", headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" }, body: JSON.stringify(body) });
  if (!res.ok) throw httpError(502, "La API de Anthropic respondió " + res.status + ".");
  const j = await res.json();
  const text = (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw httpError(502, "La IA no devolvió un JSON utilizable.");
  const o = JSON.parse(m[0]), arr = (x) => (Array.isArray(x) ? x.map(String) : []);
  return { summary: String(o.summary || ""), bull: arr(o.bull), bear: arr(o.bear),
    swot: { s: arr(o.swot && o.swot.s), w: arr(o.swot && o.swot.w), o: arr(o.swot && o.swot.o), t: arr(o.swot && o.swot.t) }, model: ANTHROPIC_MODEL };
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let n = 0; const parts = [];
    req.on("data", (c) => { n += c.length; if (n > limit) { reject(httpError(413, "Solicitud demasiado grande.")); req.destroy(); } else parts.push(c); });
    req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
    req.on("error", reject);
  });
}

/* ---------- servidor HTTP ---------- */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };
const STATIC = new Set(["index.html", "app.js", "data.js", "report.js", "store.js", "inbox.js", "pdfreport.js", "vendor/pdf-lib.min.js", "styles.css"]);
const TW = { sid: process.env.TWILIO_ACCOUNT_SID || "", token: process.env.TWILIO_AUTH_TOKEN || "", from: (process.env.TWILIO_WHATSAPP_FROM || "").replace(/^whatsapp:/, ""), base: process.env.TWILIO_API_BASE || "https://api.twilio.com" };
const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD || "";
const mail = require("./mail.js"), crypto = require("crypto");
const MAIL = { user: process.env.MAIL_USER || "vcc5000000@gmail.com", pass: process.env.GMAIL_APP_PASSWORD || "", host: process.env.IMAP_HOST || "imap.gmail.com", port: +(process.env.IMAP_PORT || 993), plain: process.env.IMAP_PLAIN === "1", days: 30 };
const REQ_DIR = path.join(__dirname, "db", "requests");
function reqList() { try { return fs.readdirSync(REQ_DIR).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(REQ_DIR, f), "utf8"))).sort((a, b) => String(b.recibida).localeCompare(String(a.recibida))); } catch (_) { return []; } }
function reqSave(r) { fs.mkdirSync(REQ_DIR, { recursive: true }); fs.writeFileSync(path.join(REQ_DIR, r.id + ".json"), JSON.stringify(r)); }
function reqHas(id) { return fs.existsSync(path.join(REQ_DIR, id + ".json")); }
/* Convierte un mensaje en solicitud si el asunto es «Análisis financiero:TICKER»; si no, devuelve null */
function toRequest(m) {
  const p = mail.parseSubject(m.subject); if (!p) return null;
  const id = crypto.createHash("sha1").update(m.messageId || (m.from + m.subject + m.date + m.uid)).digest("hex").slice(0, 16);
  return { id, ticker: p.ticker, empresa: p.empresa, asunto: m.subject, remitente: m.from, whatsapp: m.phone || "", fragmento: m.snippet || "", recibida: m.date || new Date().toISOString(), capturada: new Date().toISOString(), estado: "recibida", canal: m.canal || "correo" };
}
const DB_DIR = path.join(__dirname, "db"), DB_TABLES = new Set(["financials", "analysis", "reports"]);
const dbFile = (t, k) => path.join(DB_DIR, t, k.replace(/[^A-Za-z0-9._\-]/g, "_") + ".json");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const send = (code, body, type) => { res.writeHead(code, { "Content-Type": type || "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
  // Candado de acceso para la publicación (MVP): si defines ACCESS_PASSWORD, todo pide usuario y clave (HTTP Basic). /api/health queda libre para el hosting.
  if (ACCESS_PASSWORD && url.pathname !== "/api/health" && !/^\/r\/[a-f0-9]{24}(\.pdf)?$/.test(url.pathname)) {
    const m = /^Basic (.+)$/.exec(req.headers.authorization || ""); const given = m ? Buffer.from(m[1], "base64").toString("utf8") : "";
    const ok = given.slice(given.indexOf(":") + 1) === ACCESS_PASSWORD && given.indexOf(":") >= 0;
    if (!ok) { res.writeHead(401, { "WWW-Authenticate": 'Basic realm="VCC50000", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" }); return res.end("Acceso restringido."); }
  }
  const SHARE_DIR = path.join(__dirname, "db", "shared");
  const baseUrl = () => process.env.PUBLIC_URL || ((req.headers["x-forwarded-proto"] || "http").split(",")[0] + "://" + req.headers.host);
  try {
    if (url.pathname.startsWith("/r/") && req.method === "GET") {   // informe compartido: enlace con código no adivinable, sin clave de acceso
      let t = url.pathname.slice(3); const isPdf = t.endsWith(".pdf"); if (isPdf) t = t.slice(0, -4);
      const f = path.join(SHARE_DIR, t + (isPdf ? ".pdf" : ".html"));
      if (!/^[a-f0-9]{24}$/.test(t) || !fs.existsSync(f)) return send(404, "Informe no encontrado o vencido.", "text/plain; charset=utf-8");
      if (isPdf) { res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="VCC50000_Insight.pdf"', "Cache-Control": "no-store" }); return res.end(fs.readFileSync(f)); }
      return send(200, fs.readFileSync(f), "text/html; charset=utf-8");
    }
    if (url.pathname === "/api/report/publish" && req.method === "POST") {
      const b = JSON.parse((await readBody(req, 14000000)) || "{}"); if (typeof b.html !== "string" || b.html.length < 200) return send(400, { error: "No hay informe para publicar." });
      const t = crypto.randomBytes(12).toString("hex"); fs.mkdirSync(SHARE_DIR, { recursive: true }); fs.writeFileSync(path.join(SHARE_DIR, t + ".html"), b.html);
      let pdfUrl = ""; if (typeof b.pdf === "string" && b.pdf.length > 100) { const buf = Buffer.from(b.pdf, "base64"); if (buf.slice(0, 5).toString() === "%PDF-") { fs.writeFileSync(path.join(SHARE_DIR, t + ".pdf"), buf); pdfUrl = baseUrl() + "/r/" + t + ".pdf"; } }
      return send(200, { url: baseUrl() + "/r/" + t, pdfUrl });
    }
    if (url.pathname === "/api/whatsapp/send" && req.method === "POST") {
      const b = JSON.parse((await readBody(req, 20000)) || "{}"); const to = String(b.to || "").replace(/\D/g, ""), body = String(b.body || "").slice(0, 1500);
      if (to.length < 8 || to.length > 15) return send(400, { error: "Número de WhatsApp no válido (incluye el código de país)." });
      if (!TW.sid || !TW.token || !TW.from) return send(200, { enviado: false, simulado: true, to, body, aviso: "WhatsApp automático sin configurar (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM)." });
      const r = await fetch(TW.base + "/2010-04-01/Accounts/" + TW.sid + "/Messages.json", { method: "POST", headers: { Authorization: "Basic " + Buffer.from(TW.sid + ":" + TW.token).toString("base64"), "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(Object.assign({ From: "whatsapp:" + TW.from, To: "whatsapp:+" + to, Body: body }, /^https:\/\//.test(String(b.mediaUrl || "")) ? { MediaUrl: String(b.mediaUrl) } : {})).toString() });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return send(502, { error: "WhatsApp rechazó el envío: " + (j.message || r.status) });
      return send(200, { enviado: true, sid: j.sid, to });
    }
    if (url.pathname === "/api/health") return send(200, { ok: true, secContact: !!CONTACT, ai: !!ANTHROPIC_KEY, buzon: MAIL.user, buzonConfigurado: !!MAIL.pass, whatsappConfigurado: !!(TW.sid && TW.token && TW.from), version: "VCC50000-v11", carpeta: __dirname });
    if (url.pathname === "/api/draft" && req.method === "POST") {
      return send(200, await aiDraft(JSON.parse((await readBody(req, 300000)) || "{}")));
    }
    if (url.pathname === "/api/inbox" && req.method === "GET") return send(200, { buzon: MAIL.user, configurado: !!MAIL.pass, solicitudes: reqList() });
    if (url.pathname === "/api/inbox/check" && req.method === "POST") {
      if (!MAIL.pass) return send(400, { error: "Falta GMAIL_APP_PASSWORD en iniciar.bat (contraseña de aplicación de " + MAIL.user + "). Mientras tanto puedes probar con un asunto." });
      const msgs = await mail.fetchRecent({ host: MAIL.host, port: MAIL.port, plain: MAIL.plain, user: MAIL.user, pass: MAIL.pass, days: MAIL.days });
      let nuevas = 0, ignoradas = 0;
      msgs.forEach((m) => { const r = toRequest(m); if (!r) { ignoradas++; return; } if (!reqHas(r.id)) { reqSave(r); nuevas++; } });
      return send(200, { revisados: msgs.length, nuevas, ignoradas, solicitudes: reqList() });
    }
    if (url.pathname === "/api/inbox/test" && req.method === "POST") {
      const b = JSON.parse((await readBody(req, 20000)) || "{}");
      const r = toRequest({ subject: String(b.subject || ""), from: String(b.from || "Prueba manual"), phone: mail.findPhone(String(b.from || "")), messageId: "test-" + Date.now(), date: new Date().toISOString(), snippet: "", uid: "0", canal: "prueba" });
      if (!r) return send(400, { error: "El asunto no cumple el formato «Análisis financiero:TICKER» (por ejemplo, «Análisis financiero:EC»)." });
      reqSave(r); return send(200, { solicitud: r, solicitudes: reqList() });
    }
    if (url.pathname === "/api/inbox/status" && req.method === "POST") {
      const b = JSON.parse((await readBody(req, 5000)) || "{}"); const f = path.join(REQ_DIR, String(b.id || "").replace(/[^a-f0-9\-]/gi, "") + ".json");
      if (!fs.existsSync(f)) return send(404, { error: "Solicitud no encontrada." });
      const r = JSON.parse(fs.readFileSync(f, "utf8")); r.estado = ["recibida", "en atención", "atendida"].includes(b.estado) ? b.estado : r.estado; reqSave(r); return send(200, { solicitud: r });
    }
    if (url.pathname.startsWith("/api/db/")) {
      const [, , , table, rawKey] = url.pathname.split("/"); const key = decodeURIComponent(rawKey || "");
      if (!DB_TABLES.has(table) || !/^[A-Za-z0-9._\-|]{1,60}$/.test(key)) return send(400, { error: "Tabla o clave no válida." });
      const f = dbFile(table, key);
      if (req.method === "PUT") { const rec = JSON.parse((await readBody(req, 3000000)) || "{}"); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(rec)); return send(200, { ok: true }); }
      if (req.method === "DELETE") { try { fs.unlinkSync(f); } catch (_) {} return send(200, { ok: true }); }
      if (!fs.existsSync(f)) return send(200, "null");
      return send(200, fs.readFileSync(f, "utf8"));
    }
    if (url.pathname === "/api/financials") {
      const ticker = (url.searchParams.get("ticker") || "").toUpperCase();
      if (!/^[A-Z][A-Z0-9.\-]{0,5}$/.test(ticker)) return send(400, { error: "Ticker no válido." });
      return send(200, await getFinancials(ticker, url.searchParams.get("source") === "local"));
    }
    const name = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (STATIC.has(name)) return send(200, fs.readFileSync(path.join(__dirname, name)), MIME[path.extname(name)]);
    send(404, { error: "No encontrado." });
  } catch (err) {
    send(err.status || 500, { error: err.message });
  }
});

if (require.main === module) {
  server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      console.log("\nERROR: el puerto " + PORT + " ya está ocupado por otro programa (probablemente una versión anterior de esta página).");
      console.log("Cierra las otras ventanas negras de Node, o ejecuta en CMD:  taskkill /F /IM node.exe\nluego vuelve a abrir iniciar.bat.");
      process.exit(1);
    }
    throw e;
  });
  server.listen(PORT, () => {
    console.log("VCC50000 v11 — carpeta: " + __dirname);
    console.log("Página y API en http://localhost:" + PORT);
    if (!CONTACT) console.log("AVISO: define SEC_CONTACT para consultar la SEC (se usará solo el catálogo local).");
  });
}
module.exports = { normalize, annual };
