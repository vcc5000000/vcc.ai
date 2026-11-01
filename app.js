"use strict";

/* ============================================================
   CONFIGURACIÓN
   - API_BASE: URL de tu backend. Vacío = usa el catálogo local data.js.
     El backend debe exponer GET {API_BASE}/financials?ticker=XXX
     y responder JSON con este formato:
     {
       "ticker": "EC", "name": "Ecopetrol S.A.", "currency": "COP",
       "unit": "miles de millones", "source": "SEC EDGAR 20-F FY2025",
       "years": ["2023","2024","2025"],
       "sales": [..], "grossProfit": [..], "operatingIncome": [..], "netIncome": [..]
     }
   ============================================================ */
const CONFIG = {
  API_BASE: "",
  STORAGE_KEY: "fin-app-registro",
};

/* ------------------------------------------------------------
   VARIABLE GLOBAL DEL TICKER
   Se asigna en el paso 2 (combo o caja de texto) con setTicker()
   y se lee en el paso 3 (cargar estados, crear gráficas) y en los
   prompts de los skills. Es una propiedad de window.
   ------------------------------------------------------------ */
var TICKER_GLOBAL = "";

/* ------------------------------------------------------------
   Lista de tickers del combo.
   Es una lista corta y editable; un ticker que no esté aquí se
   puede digitar con la opción «Otro».
   ------------------------------------------------------------ */
const TICKERS = [
  ["EC", "Ecopetrol S.A."], ["CIB", "Bancolombia S.A."], ["AVAL", "Grupo Aval Acciones y Valores"],
  ["PBR", "Petróleo Brasileiro S.A. (Petrobras)"], ["VALE", "Vale S.A."], ["ITUB", "Itaú Unibanco"],
  ["BBD", "Banco Bradesco"], ["BAP", "Credicorp Ltd."], ["SQM", "Sociedad Química y Minera de Chile"],
  ["CX", "Cemex S.A.B. de C.V."], ["AMX", "América Móvil"], ["FMX", "Fomento Económico Mexicano (FEMSA)"],
  ["MELI", "MercadoLibre"], ["NU", "Nu Holdings"], ["GGAL", "Grupo Financiero Galicia"],
  ["YPF", "YPF S.A."], ["TX", "Ternium S.A."], ["ABEV", "Ambev S.A."], ["SBS", "Sabesp"],
  ["AAPL", "Apple Inc."], ["MSFT", "Microsoft Corporation"], ["GOOGL", "Alphabet Inc. (Clase A)"],
  ["AMZN", "Amazon.com, Inc."], ["META", "Meta Platforms, Inc."], ["NVDA", "NVIDIA Corporation"],
  ["TSLA", "Tesla, Inc."], ["NFLX", "Netflix, Inc."], ["ORCL", "Oracle Corporation"],
  ["IBM", "International Business Machines"], ["INTC", "Intel Corporation"], ["AMD", "Advanced Micro Devices"],
  ["JPM", "JPMorgan Chase & Co."], ["BAC", "Bank of America"], ["C", "Citigroup Inc."],
  ["WFC", "Wells Fargo & Company"], ["GS", "Goldman Sachs Group"], ["V", "Visa Inc."],
  ["MA", "Mastercard Incorporated"], ["BRK.B", "Berkshire Hathaway (Clase B)"],
  ["XOM", "Exxon Mobil Corporation"], ["CVX", "Chevron Corporation"], ["COP", "ConocoPhillips"],
  ["OXY", "Occidental Petroleum"], ["SLB", "SLB (Schlumberger Limited)"], ["HAL", "Halliburton Company"],
  ["BKR", "Baker Hughes Company"], ["WFRD", "Weatherford International plc"],
  ["GUACAM", "Guacamaya Energy Services (sin ticker público)"], ["SHEL", "Shell plc"], ["BP", "BP p.l.c."], ["TTE", "TotalEnergies SE"],
  ["KO", "The Coca-Cola Company"], ["PEP", "PepsiCo, Inc."], ["WMT", "Walmart Inc."],
  ["COST", "Costco Wholesale"], ["DIS", "The Walt Disney Company"], ["NKE", "NIKE, Inc."],
  ["MCD", "McDonald's Corporation"], ["PG", "The Procter & Gamble Company"], ["JNJ", "Johnson & Johnson"],
  ["PFE", "Pfizer Inc."], ["UNH", "UnitedHealth Group"], ["BA", "The Boeing Company"],
  ["CAT", "Caterpillar Inc."], ["GE", "GE Aerospace"], ["F", "Ford Motor Company"],
  ["GM", "General Motors Company"], ["T", "AT&T Inc."], ["VZ", "Verizon Communications"],
];

/* Los datos salen de data.js (window.FIN_CATALOG / FIN_ALIASES), generado desde los PDF de la carpeta 00 -- EEFF. */

/* ------------------------------------------------------------
   Skills precargados y sus prompts ({ticker} se reemplaza)
   ------------------------------------------------------------ */
const SKILLS = [
  {
    id: "analyzing-financial-statements",
    title: "Análisis de estados financieros",
    desc: "Calcula ratios de rentabilidad, liquidez, apalancamiento y eficiencia, con tendencia por periodos y un Excel de resultados.",
    prompt:
      "Usa el skill analyzing-financial-statements para calcular los ratios financieros de {ticker} " +
      "(rentabilidad, liquidez, apalancamiento y eficiencia) con los estados financieros de los últimos 3 años. " +
      "Muestra la tendencia por año, interpreta los resultados y entrégame un Excel con los ratios formateados. " +
      "Indica la fuente del filing y la moneda de cada cifra.",
  },
  {
    id: "creating-financial-models",
    title: "Modelos financieros y valoración",
    desc: "Construye un DCF con análisis de sensibilidad y escenarios, y entrega el modelo en Excel.",
    prompt:
      "Usa el skill creating-financial-models para construir un modelo DCF de {ticker} con análisis de " +
      "sensibilidad (WACC vs. crecimiento terminal) y tres escenarios: base, optimista y pesimista. " +
      "Antes de proyectar, pregúntame los supuestos clave (crecimiento de ingresos, márgenes, capex, WACC y " +
      "crecimiento terminal). Entrégame un Excel con el modelo y aclara que es apoyo analítico, no una recomendación de inversión.",
  },
];

/* Prompt de las gráficas ({ticker} se reemplaza con TICKER_GLOBAL) */
const CHART_PROMPT =
  "Using this data for {ticker}, create a visual interactive graph from the files to show revenue by segment and other important metrics " +
  "(gross, operating and net margins, year-over-year growth, operating income and net income). " +
  "Use only the figures contained in the files (financial statements in the 00 -- EEFF folder / the catalog Excel); " +
  "if the files do not include a segment breakdown, say so explicitly and show revenue by the closest available split or against peers instead. Never invent numbers. " +
  "Make it interactive (hover tooltips, clickable legend, tabs per metric) and state the currency, unit and source on every chart. " +
  "Design it for a corporate board audience: clean, high-impact, with one executive takeaway per chart. Write labels and takeaways in Spanish. " +
  "Deliver an interactive HTML page and the Excel with the data used.";

function buildChartPrompt(ticker) { return CHART_PROMPT.split("{ticker}").join(ticker || "[TICKER]"); }
function claudeUrl(text) { return "https://claude.ai/new?q=" + encodeURIComponent(text); }

/* ============================================================
   ESTADO Y UTILIDADES
   ============================================================ */
const $ = (id) => document.getElementById(id);
const state = { registered: false, name: "", data: null };

function setStatus(el, msg, kind) {
  el.textContent = msg || "";
  el.className = "status" + (kind ? " " + kind : "");
}
function setError(forId, msg) {
  const el = document.querySelector('.err[data-for="' + forId + '"]');
  if (el) el.textContent = msg || "";
  const input = $(forId);
  if (input) input.setAttribute("aria-invalid", msg ? "true" : "false");
}
function unlock(sectionId) { $(sectionId).classList.remove("locked"); }
function fmt(n) { return n.toLocaleString("es-CO", { maximumFractionDigits: 0 }); }
function fmtN(n) { return n === null ? "n.d." : fmt(n); }
function pctN(n) { return n === null ? "n.d." : pct(n); }
function pct(n) { return n.toLocaleString("es-CO", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + "%"; }

/* ============================================================
   PASO 1 — REGISTRO
   Nota: se guarda en localStorage del navegador (solo demostración).
   Para un registro real, envía estos datos a tu backend por HTTPS.
   ============================================================ */
function initRegister() {
  const saved = safeGet(CONFIG.STORAGE_KEY);
  if (saved && saved.email) {
    $("reg-name").value = saved.name || "";
    $("reg-email").value = saved.email;
    $("reg-org").value = saved.org || "";
    $("reg-role").value = saved.role || "";
    $("reg-consent").checked = true;
    setStatus($("reg-status"), "Sesión recuperada para " + saved.email + ".", "ok");
    enableTickerStep();
  }

  $("register-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("reg-name").value.trim();
    const email = $("reg-email").value.trim();
    let ok = true;

    setError("reg-name", ""); setError("reg-email", ""); setError("reg-consent", "");
    if (name.length < 2) { setError("reg-name", "Escribe tu nombre."); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setError("reg-email", "Correo no válido."); ok = false; }
    if (!$("reg-consent").checked) { setError("reg-consent", "Debes aceptar para continuar."); ok = false; }
    if (!ok) return;

    const record = { name, email, org: $("reg-org").value.trim(), role: $("reg-role").value, at: new Date().toISOString() };
    safeSet(CONFIG.STORAGE_KEY, record);
    setStatus($("reg-status"), "Registro guardado. Continúa con el paso 2.", "ok");
    enableTickerStep();
  });
}

function enableTickerStep() {
  state.registered = true;
  unlock("step-ticker");
  $("ticker-select").disabled = false;
  $("ticker-other").disabled = false;
  $("btn-send-ticker").disabled = false;
  $("ticker-select").focus();
}

function safeGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (_) { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* almacenamiento no disponible */ } }

/* ============================================================
   PASO 2 — TICKER: COMBO + CAJA DE TEXTO (cualquiera es válida)
   ============================================================ */
const TICKER_RE = /^[A-Z][A-Z0-9.\-]{0,5}$/;

/* Única función que escribe la variable global del ticker. */
function setTicker(ticker) {
  TICKER_GLOBAL = ticker;
  const known = TICKERS.find(([s]) => s === ticker);
  state.name = known ? known[1] : ticker;
  state.data = null;
  $("fin-table-wrap").hidden = true; $("charts-wrap").hidden = true;
  if (typeof onTickerChanged === "function") onTickerChanged();
  $("selected-company").textContent = ticker + (known ? " — " + known[1] : "");
}

function initTicker() {
  const sel = $("ticker-select");
  const typed = $("ticker-other");

  sel.add(new Option("Selecciona un ticker…", ""));
  [...TICKERS].sort((a, b) => a[0].localeCompare(b[0])).forEach(([sym, name]) => {
    sel.add(new Option(sym + " — " + name, sym));
  });

  // Si usa una opción, la otra se limpia.
  sel.addEventListener("change", () => {
    setError("ticker-select", ""); setError("ticker-other", "");
    if (sel.value) typed.value = "";
  });
  typed.addEventListener("input", () => {
    typed.value = typed.value.toUpperCase().replace(/\s+/g, "");
    setError("ticker-select", ""); setError("ticker-other", "");
    if (typed.value) sel.value = "";
  });

  $("ticker-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!state.registered) return;
    setError("ticker-select", ""); setError("ticker-other", "");

    const typedVal = typed.value.trim().toUpperCase();
    let ticker = "";
    if (typedVal) {
      if (!TICKER_RE.test(typedVal)) {
        setError("ticker-other", "Ticker no válido. Usa 1 a 6 caracteres: letras, números, punto o guion.");
        typed.focus();
        return;
      }
      ticker = typedVal;
    } else if (sel.value) {
      ticker = sel.value;
    } else {
      setError("ticker-select", "Elige un ticker de la lista o escríbelo en la caja.");
      return;
    }

    setTicker(ticker);   // <- asigna TICKER_GLOBAL

    setStatus($("ticker-status"), "Ticker enviado: " + TICKER_GLOBAL + ".", "ok");
    setStatus($("action-status"), "");
    $("fin-table-wrap").hidden = true;
    $("charts-wrap").hidden = true;
    $("chart-prompt-wrap").hidden = true;

    unlock("step-actions");
    unlock("step-report");              // el informe se activa con el ticker; si faltan datos, los carga solo
    if (typeof onTickerSent === "function") onTickerSent();
    $("btn-load").disabled = false;
    $("btn-charts").disabled = false;   // el prompt de gráficas solo necesita el ticker
    renderSkills();
  });
}

/* ============================================================
   PASO 3 — CARGAR ESTADOS FINANCIEROS Y CREAR GRÁFICAS
   ============================================================ */
function apiBase() {
  if (CONFIG.API_BASE) return CONFIG.API_BASE.replace(/\/$/, "");
  return /^https?:$/.test(location.protocol) ? "/api" : "";   // servida por server.js => mismo origen
}

async function fetchFinancials(ticker) {
  const base = apiBase();
  if (base) {
    let res = null;
    try { res = await fetch(base + "/financials?ticker=" + encodeURIComponent(ticker), { headers: { Accept: "application/json" } }); }
    catch (_) { res = null; }   // sin servidor: se usa el catálogo local
    if (res && res.ok) {
      const d = validateData(await res.json());
      d.notice = d.notice || "";
      return d;
    }
    if (res) {
      let msg = "El servidor respondió " + res.status + ".";
      try { const j = await res.json(); if (j.error) msg = j.error; } catch (_) {}
      throw new Error(msg);
    }
  }
  // Catálogo local (data.js), generado desde los PDF de la carpeta de estados financieros.
  await new Promise((r) => setTimeout(r, 250));
  const cat = window.FIN_CATALOG, al = window.FIN_ALIASES;
  if (!cat) throw new Error("No se cargó data.js. Verifica que esté en la misma carpeta que index.html.");
  const alias = al && al[ticker];
  const key = alias ? alias.to : ticker;
  if (cat[key]) {
    const d = validateData(Object.assign({}, cat[key]));
    d.notice = alias && alias.notice ? alias.notice : "";
    return d;
  }
  throw new Error(
    "No hay estados financieros cargados para " + ticker + ". Disponibles: " +
    Object.keys(cat).concat(Object.keys(al || {})).filter((v, i, a) => a.indexOf(v) === i).join(", ") +
    ". Agrega su PDF a la carpeta y regenera data.js, o configura API_BASE."
  );
}

function validateData(d) {
  if (!d || !Array.isArray(d.years) || !d.years.length) throw new Error("Respuesta sin años.");
  const num = (v) => typeof v === "number" && isFinite(v);
  for (const k of ["sales", "grossProfit", "operatingIncome", "netIncome"]) {
    if (!Array.isArray(d[k]) || d[k].length !== d.years.length) throw new Error("Datos inválidos en '" + k + "'.");
    if (d[k].some((v) => v !== null && !num(v))) throw new Error("Datos inválidos en '" + k + "'.");
  }
  if (d.sales.some((v) => v === null)) throw new Error("Hay años sin ingresos en la respuesta.");
  // Campos opcionales (balance, flujo de caja, EBITDA, EPS): si vienen mal formados se descartan
  const okArr = (a) => Array.isArray(a) && a.length === d.years.length && a.every((v) => v === null || num(v));
  if (!okArr(d.ebitda)) d.ebitda = null;
  if (!okArr(d.eps)) d.eps = null;
  ["balance", "cashflow"].forEach((g) => {
    if (!d[g] || typeof d[g] !== "object") { d[g] = null; return; }
    Object.keys(d[g]).forEach((k) => { if (!okArr(d[g][k])) d[g][k] = null; });
  });
  return d;
}

function renderTable(d) {
  const t = $("fin-table");
  t.replaceChildren();
  const thead = t.createTHead().insertRow();
  const head = ["Concepto (" + d.currency + " " + d.unit + ")"].concat(d.years);
  head.forEach((h) => { const th = document.createElement("th"); th.textContent = h; thead.appendChild(th); });

  const rows = [
    ["Ventas", d.sales, fmt], ["Utilidad bruta", d.grossProfit, fmtN],
    ["Utilidad operacional", d.operatingIncome, fmtN], ["Utilidad neta", d.netIncome, fmtN],
    ["Margen bruto", pctOf(d.grossProfit, d.sales), pctN],
    ["Margen operacional", pctOf(d.operatingIncome, d.sales), pctN],
    ["Margen neto", pctOf(d.netIncome, d.sales), pctN],
  ];
  const tb = t.createTBody();
  rows.forEach(([label, vals, f]) => {
    const tr = tb.insertRow();
    tr.insertCell().textContent = label;
    vals.forEach((v) => { tr.insertCell().textContent = f(v); });
  });
  $("fin-note").textContent = (d.notice ? d.notice + " " : "") + "Fuente: " + d.source + (d.via === "edgar" ? " (consulta en vivo a la SEC)" : "") + ". n.d. = no disponible en la fuente.";
  $("fin-table-wrap").hidden = false;
}

/* Carga los estados del TICKER_GLOBAL. Devuelve true si quedó state.data. Lo usan el botón del paso 3 y el informe del paso 4. */
async function loadFinancials(force) {
  const ticker = TICKER_GLOBAL;
  if (!ticker) { setStatus($("action-status"), "Primero elige y envía un ticker (paso 2).", "bad"); return false; }
  $("btn-load").disabled = true;
  setStatus($("action-status"), "Cargando estados financieros de " + ticker + "…");
  try {
    let data = null, fromDb = null;
    const rec = !force && typeof Store !== "undefined" ? await Store.get("financials", ticker) : null;
    if (rec && rec.value) { try { data = validateData(rec.value); fromDb = rec.updated; } catch (_) { data = null; } }
    if (!data) {
      data = await fetchFinancials(ticker);
      if (typeof Store !== "undefined") await Store.put("financials", ticker, data);
    }
    if (ticker !== TICKER_GLOBAL) return false;   // el usuario cambió de ticker mientras cargaba
    state.data = data; state.fromDb = fromDb;
    renderTable(data);
    if (typeof onFinancialsLoaded === "function") onFinancialsLoaded(data);
    setStatus($("action-status"), "Estados financieros de " + ticker + (fromDb ? " recuperados de la base de datos local (guardados " + new Date(fromDb).toLocaleString("es-CO") + ")." : " cargados y guardados en la base de datos local.") + (data.notice ? " Atención: " + data.notice : ""), "ok");
    return true;
  } catch (err) {
    if (ticker !== TICKER_GLOBAL) return false;
    state.data = null;
    $("fin-table-wrap").hidden = true;
    setStatus($("action-status"), err.message, "bad");
    return false;
  } finally {
    $("btn-load").disabled = false;
  }
}

function initActions() {
  $("btn-load").addEventListener("click", () => { loadFinancials(); });

  // Prompt de las gráficas: se arma en el clic con el valor actual de TICKER_GLOBAL
  const promptBox = $("chart-prompt");
  promptBox.addEventListener("input", () => { $("chart-prompt-open").href = claudeUrl(promptBox.value); });
  $("chart-prompt-copy").addEventListener("click", async () => {
    const b = $("chart-prompt-copy");
    try { await navigator.clipboard.writeText(promptBox.value); b.textContent = "¡Copiado!"; }
    catch (_) { promptBox.select(); b.textContent = "Selecciona y copia (Ctrl+C)"; }
    setTimeout(() => (b.textContent = "Copiar prompt"), 1800);
  });

  $("btn-charts").addEventListener("click", () => {
    const ticker = TICKER_GLOBAL;
    if (!ticker) return;

    const prompt = buildChartPrompt(ticker);
    promptBox.value = prompt;
    $("chart-prompt-open").href = claudeUrl(prompt);
    $("chart-prompt-wrap").hidden = false;

    if (state.data) {
      $("charts-title").textContent = "Evolución de ingresos y márgenes — " + ticker + " (" + state.name + ")";
      renderKpis(state.data);
      $("charts-wrap").hidden = false;
      setView(chartState.view);
      setStatus($("action-status"), "Gráficas de " + ticker + " creadas y prompt listo.", "ok");
    } else {
      $("charts-wrap").hidden = true;
      setStatus($("action-status"),
        "Prompt de las gráficas listo para " + ticker + ". Para verlas aquí, primero carga los estados financieros.", "ok");
    }
    $("chart-prompt-wrap").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

/* ------------------------------------------------------------
   Gráficas interactivas en canvas (sin librerías externas)
   Vistas: ingresos y utilidades | márgenes | crecimiento | pares
   Interacción: tooltip al pasar el cursor, leyenda clicable, pestañas.
   ------------------------------------------------------------ */
const C = { cyan: "#2dd4d8", violet: "#ff8fa3", amber: "#ffc53d", green: "#46d39a", rose: "#ff7a59", blue: "#7fb7ff",
            grid: "rgba(255,255,255,.09)", ink: "#e8eefc", muted: "#93a4c3" };
const VIEW_LABELS = { ingresos: "Ingresos y utilidades", margenes: "Márgenes", crecimiento: "Crecimiento anual", pares: "Comparativo de pares" };
const chartState = { view: "ingresos", hover: -1, hidden: {}, model: null, layout: null };

function pctOf(a, b) { return a.map((v, i) => (v === null || !b[i] ? null : (v / b[i]) * 100)); }
function yoy(a) { return a.map((v, i) => (i === 0 || v === null || a[i - 1] === null || a[i - 1] <= 0 ? null : ((v - a[i - 1]) / a[i - 1]) * 100)); }

function peerSeries(d) {
  const cat = window.FIN_CATALOG || {};
  const peers = Object.keys(cat).filter((k) => cat[k].currency === d.currency && cat[k].unit === d.unit && cat[k].years.length >= 4);
  // Evita mezclar escalas (p. ej. Ecopetrol con filiales de servicios): solo pares dentro de un factor 50
  const base = Math.max.apply(null, d.sales);
  const ok = peers.filter((k) => { const m = Math.max.apply(null, cat[k].sales); return m <= base * 50 && m >= base / 50; });
  if (ok.length < 2) return null;
  const years = Array.from(new Set([].concat.apply([], ok.map((k) => cat[k].years)))).sort();
  const pal = [C.cyan, C.amber, C.violet, C.green, C.rose, C.blue];
  return {
    years, unit: d.currency + " " + d.unit, kind: "lines", fmt: fmt,
    series: ok.map((k, i) => ({ n: cat[k].name.replace(/ S\.?A\.?S?\.?$/, ""), c: pal[i % pal.length], bold: k === (window.FIN_ALIASES && window.FIN_ALIASES[TICKER_GLOBAL] ? window.FIN_ALIASES[TICKER_GLOBAL].to : TICKER_GLOBAL),
      v: years.map((y) => { const j = cat[k].years.indexOf(y); return j < 0 ? null : cat[k].sales[j]; }) })),
  };
}

function buildModel(view, d) {
  if (view === "ingresos") return { years: d.years, unit: d.currency + " " + d.unit, kind: "bars", fmt: fmt, series: [
    { n: "Ingresos", c: C.cyan, v: d.sales }, { n: "Utilidad bruta", c: C.violet, v: d.grossProfit },
    { n: "Utilidad operacional", c: C.amber, v: d.operatingIncome }, { n: "Utilidad neta", c: C.green, v: d.netIncome }] };
  if (view === "margenes") return { years: d.years, unit: "% de ingresos", kind: "lines", fmt: pct, axis: (v) => v.toFixed(0) + "%", series: [
    { n: "Margen bruto", c: C.violet, v: pctOf(d.grossProfit, d.sales) }, { n: "Margen operacional", c: C.amber, v: pctOf(d.operatingIncome, d.sales) },
    { n: "Margen neto", c: C.green, v: pctOf(d.netIncome, d.sales) }] };
  if (view === "crecimiento") return { years: d.years, unit: "variación % anual", kind: "bars", fmt: pct, axis: (v) => v.toFixed(0) + "%", series: [
    { n: "Crecimiento de ingresos", c: C.cyan, v: yoy(d.sales) }, { n: "Variación utilidad operacional", c: C.amber, v: yoy(d.operatingIncome) }] };
  return peerSeries(d);
}

function renderKpis(d) {
  const n = d.years.length, i = n - 1, g = yoy(d.sales)[i];
  const tiles = [
    ["Ingresos " + d.years[i], fmt(d.sales[i]), d.currency + " " + d.unit],
    ["Crecimiento anual", g === null ? "n.d." : (g >= 0 ? "▲ " : "▼ ") + pct(Math.abs(g)), "vs. " + d.years[i - 1]],
    ["Margen operacional", pctN(pctOf(d.operatingIncome, d.sales)[i]), "utilidad operacional / ingresos"],
    ["Margen neto", pctN(pctOf(d.netIncome, d.sales)[i]), "utilidad neta / ingresos"],
  ];
  if (n >= 3 && d.sales[0] > 0) {
    const cagr = (Math.pow(d.sales[i] / d.sales[0], 1 / (n - 1)) - 1) * 100;
    tiles.push(["CAGR ingresos", (cagr >= 0 ? "" : "−") + pct(Math.abs(cagr)), d.years[0] + "–" + d.years[i]]);
  }
  const box = $("kpis"); box.replaceChildren();
  tiles.forEach(([k, v, s]) => {
    const t = document.createElement("div"); t.className = "kpi";
    const a = document.createElement("span"); a.className = "kpi-k"; a.textContent = k;
    const b = document.createElement("strong"); b.className = "kpi-v"; b.textContent = v;
    const c = document.createElement("span"); c.className = "kpi-s"; c.textContent = s;
    t.append(a, b, c); box.appendChild(t);
  });
}

function renderLegend() {
  const box = $("chart-legend"); box.replaceChildren();
  const m = chartState.model; if (!m) return;
  m.series.forEach((s, i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip";
    const off = chartState.hidden[chartState.view + i];
    b.setAttribute("aria-pressed", off ? "false" : "true");
    const dot = document.createElement("i"); dot.style.background = s.c;
    b.append(dot, document.createTextNode(s.n));
    b.addEventListener("click", () => { chartState.hidden[chartState.view + i] = !off; renderLegend(); drawChart(); });
    box.appendChild(b);
  });
}

function setView(view) {
  const d = state.data; if (!d) return;
  chartState.view = view; chartState.hover = -1;
  chartState.model = buildModel(view, d);
  document.querySelectorAll("#chart-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === view)));
  const m = chartState.model, empty = $("chart-empty");
  if (!m) {
    empty.hidden = false; empty.textContent = "No hay suficientes compañías comparables con la misma moneda y escala para esta vista.";
    $("chart-legend").replaceChildren(); $("chart-canvas").hidden = true; $("cap-main").textContent = ""; return;
  }
  empty.hidden = true; $("chart-canvas").hidden = false;
  $("cap-main").textContent = TICKER_GLOBAL + " · " + VIEW_LABELS[view] + " (" + m.unit + ")";
  renderLegend(); drawChart();
}

function niceRange(min, max) {
  if (min > 0) min = 0; if (max < 0) max = 0; if (min === max) max = min + 1;
  const raw = (max - min) / 5, p = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / p;
  const step = (r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10) * p;
  return { min: Math.floor(min / step) * step, max: Math.ceil(max / step) * step, step: step };
}

const LIGHT = { grid: "#e3e8ef", ink: "#0b2a4a", muted: "#51708c", zero: "rgba(11,42,74,.45)", hover: "rgba(11,42,74,.06)",
  map: { "#2dd4d8": "#0a8f98", "#ff8fa3": "#e5533f", "#ffc53d": "#d98e00", "#46d39a": "#1f9d6b", "#ff7a59": "#c4452c", "#7fb7ff": "#2f6fcf" } };
const DARK = { grid: C.grid, ink: C.ink, muted: C.muted, zero: "rgba(255,255,255,.35)", hover: "rgba(255,255,255,.07)", map: {} };

/* Dibuja un modelo en un canvas. o: { hidden(i), hover, theme: "dark"|"light", width, scale }.
   Se usa en pantalla (oscuro, interactivo) y en el informe (claro, para PDF/HTML). */
function paintChart(cv, m, o) {
  o = o || {};
  const T = o.theme === "light" ? LIGHT : DARK, col = (c) => T.map[c] || c;
  const dpr = o.scale || window.devicePixelRatio || 1;
  const W = o.width || cv.clientWidth || 800, H = Math.max(280, Math.min(440, Math.round(W * 0.5)));
  cv.width = W * dpr; cv.height = H * dpr; if (!o.width) cv.style.height = H + "px";
  const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  if (o.theme === "light") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H); }
  const hidden = o.hidden || (() => false), hover = o.hover === undefined ? -1 : o.hover;
  const vis = m.series.map((s, i) => (hidden(i) ? null : s));
  const vals = [].concat.apply([], vis.filter(Boolean).map((s) => s.v)).filter((v) => v !== null);
  if (!vals.length) { ctx.fillStyle = T.muted; ctx.font = "14px Segoe UI, Arial"; ctx.textAlign = "center"; ctx.fillText("Sin datos para graficar.", W / 2, H / 2); return null; }
  const R = niceRange(Math.min.apply(null, vals), Math.max.apply(null, vals));
  const L = { l: 64, r: 16, t: 16, b: 34 }, pw = W - L.l - L.r, ph = H - L.t - L.b;
  const y = (v) => L.t + ph - ((v - R.min) / (R.max - R.min)) * ph, band = pw / m.years.length;
  ctx.font = "12px Segoe UI, Arial"; ctx.lineWidth = 1;
  for (let v = R.min; v <= R.max + R.step / 2; v += R.step) {
    ctx.strokeStyle = v === 0 ? T.zero : T.grid; ctx.beginPath(); ctx.moveTo(L.l, y(v)); ctx.lineTo(W - L.r, y(v)); ctx.stroke();
    ctx.fillStyle = T.muted; ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText((m.axis || fmt)(v), L.l - 8, y(v));
  }
  m.years.forEach((yr, i) => {
    const cx = L.l + band * (i + 0.5);
    if (i === hover) { ctx.fillStyle = T.hover; ctx.fillRect(L.l + band * i, L.t, band, ph); }
    ctx.fillStyle = i === hover ? T.ink : T.muted; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText(yr, cx, H - L.b + 10);
  });
  const act = vis.filter(Boolean);
  if (m.kind === "bars") {
    const bw = Math.min(44, (band * 0.78) / act.length);
    act.forEach((s, k) => {
      s.v.forEach((v, i) => {
        if (v === null) return;
        const x = L.l + band * (i + 0.5) - (bw * act.length) / 2 + k * bw, y0 = y(0), y1 = y(v);
        ctx.fillStyle = col(s.c); ctx.globalAlpha = hover === -1 || hover === i ? 1 : 0.45;
        ctx.fillRect(x + 1, Math.min(y0, y1), bw - 2, Math.max(1, Math.abs(y1 - y0))); ctx.globalAlpha = 1;
        if (act.length <= 2 && bw > 26) { ctx.fillStyle = T.ink; ctx.textAlign = "center"; ctx.textBaseline = v >= 0 ? "bottom" : "top"; ctx.fillText(m.fmt(v), x + bw / 2, v >= 0 ? y1 - 3 : y1 + 3); }
      });
    });
  } else {
    act.forEach((s) => {
      ctx.strokeStyle = col(s.c); ctx.lineWidth = s.bold ? 3.5 : 2.2; ctx.beginPath(); let st = false;
      s.v.forEach((v, i) => { if (v === null) return; const x = L.l + band * (i + 0.5); st ? ctx.lineTo(x, y(v)) : ctx.moveTo(x, y(v)); st = true; });
      ctx.stroke();
      s.v.forEach((v, i) => {
        if (v === null) return; const x = L.l + band * (i + 0.5);
        ctx.fillStyle = col(s.c); ctx.beginPath(); ctx.arc(x, y(v), i === hover ? 6 : 3.8, 0, Math.PI * 2); ctx.fill();
      });
    });
  }
  return { L, band, W, H };
}

function drawChart() {
  const m = chartState.model; if (!m) return;
  const lay = paintChart($("chart-canvas"), m, { hidden: (i) => chartState.hidden[chartState.view + i], hover: chartState.hover, theme: "dark" });
  chartState.layout = lay;
  if (!lay) { const ctx = $("chart-canvas").getContext("2d"); ctx.fillStyle = C.muted; ctx.textAlign = "center"; ctx.fillText("Activa al menos una serie en la leyenda.", 200, 150); }
}

function showTip(ev) {
  const m = chartState.model, lay = chartState.layout, tip = $("chart-tip"); if (!m || !lay) return;
  const rect = $("chart-canvas").getBoundingClientRect(), x = ev.clientX - rect.left;
  const i = Math.floor((x - lay.L.l) / lay.band);
  if (i < 0 || i >= m.years.length) { hideTip(); return; }
  if (i !== chartState.hover) { chartState.hover = i; drawChart(); }
  tip.replaceChildren();
  const h = document.createElement("strong"); h.textContent = m.years[i]; tip.appendChild(h);
  m.series.forEach((s, k) => {
    if (chartState.hidden[chartState.view + k]) return;
    const r = document.createElement("div"), dot = document.createElement("i"); dot.style.background = s.c;
    r.append(dot, document.createTextNode(s.n + ": " + (s.v[i] === null ? "n.d." : m.fmt(s.v[i])))); tip.appendChild(r);
  });
  tip.hidden = false;
  const tw = tip.offsetWidth; tip.style.left = Math.max(4, Math.min(lay.W - tw - 4, x + 14)) + "px"; tip.style.top = "12px";
}
function hideTip() { if (chartState.hover !== -1) { chartState.hover = -1; drawChart(); } $("chart-tip").hidden = true; }

function initCharts() {
  document.querySelectorAll("#chart-tabs button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  const cv = $("chart-canvas");
  cv.addEventListener("mousemove", showTip); cv.addEventListener("mouseleave", hideTip);
  cv.addEventListener("touchstart", (e) => showTip(e.touches[0]), { passive: true });
  window.addEventListener("resize", () => { if (!$("charts-wrap").hidden) drawChart(); });
}

/* ============================================================
   SKILLS Y PROMPTS
   ============================================================ */
function promptFor(skill) { return skill.prompt.split("{ticker}").join(TICKER_GLOBAL || "[TICKER]"); }

function renderSkills() {
  const box = $("skills-list");
  box.replaceChildren();
  SKILLS.forEach((s) => {
    const card = document.createElement("article"); card.className = "skill";
    const h = document.createElement("h4"); h.textContent = s.title + " ";
    const code = document.createElement("code"); code.textContent = s.id; h.appendChild(code);
    const p = document.createElement("p"); p.textContent = s.desc;
    const ta = document.createElement("textarea");
    ta.value = promptFor(s); ta.setAttribute("aria-label", "Prompt para " + s.title);

    const row = document.createElement("div"); row.className = "row";
    const copy = document.createElement("button"); copy.type = "button"; copy.className = "btn small primary"; copy.textContent = "Copiar prompt";
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(ta.value); copy.textContent = "¡Copiado!"; }
      catch (_) { ta.select(); copy.textContent = "Selecciona y copia (Ctrl+C)"; }
      setTimeout(() => (copy.textContent = "Copiar prompt"), 1800);
    });
    const open = document.createElement("a"); open.className = "btn small"; open.target = "_blank"; open.rel = "noopener noreferrer";
    open.textContent = "Abrir en Claude"; open.href = "https://claude.ai/new?q=" + encodeURIComponent(ta.value);
    ta.addEventListener("input", () => { open.href = "https://claude.ai/new?q=" + encodeURIComponent(ta.value); });

    row.append(copy, open);
    card.append(h, p, ta, row);
    box.appendChild(card);
  });
}

/* ============================================================
   INICIO
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  initRegister();
  initTicker();
  initActions();
  initCharts();
  renderSkills();
  const cat = window.FIN_CATALOG || {};
  const ks = Object.keys(cat);
  if ($("stat-companies")) {
    $("stat-companies").textContent = ks.length;
    $("stat-years").textContent = ks.length ? Math.max.apply(null, ks.map((k) => cat[k].years.length)) : 0;
  }
});
