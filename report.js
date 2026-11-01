"use strict";
/* ============================================================
   VCC50000 Insight — informe en línea y descargable
   Estructura inspirada en un informe tipo "research report" (resumen, indicadores,
   estados financieros, pares, insights, SWOT, noticias, aviso legal).
   Contenido propio: cifras de la fuente cargada, cálculos automáticos y
   campos que digita el analista. No incluye marcas ni textos de terceros.
   ============================================================ */
(function () {
  window.VCC_REPORT_V = 19;
  const REPORT_CSS = `
  .report{font-family:"Segoe UI",Arial,sans-serif;color:#0b2a4a;background:#fff;line-height:1.45;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .report *{box-sizing:border-box}
  .r-head{background:#0b2a4a;color:#fff;padding:14px 22px;display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:5px solid;border-image:linear-gradient(90deg,#0fb5ba,#ffb627,#ff6b5b) 1}
  .r-brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:.04em;font-size:16px}
  .r-head small{opacity:.85;font-size:11px;letter-spacing:.06em;text-transform:uppercase}
  .r-title{padding:16px 22px 6px}
  .r-title h1{margin:0;font-size:26px;line-height:1.15}
  .r-title p{margin:4px 0 0;color:#51708c;font-size:12px}
  .rsec{padding:10px 22px;break-inside:avoid-page}
  .rsec h2{margin:0 0 8px;font-size:15px;padding:6px 10px;background:#f4f6f9;border-left:5px solid #0b2a4a}
  .rsec h3{margin:12px 0 6px;font-size:12.5px;padding:4px 8px;background:#f4f6f9}
  .kgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .kcell{border:1px solid #e3e8ef;border-left:4px solid #0fb5ba;border-radius:6px;padding:6px 9px}
  .kcell.m{border-left-color:#ffb627}
  .kcell span{display:block;font-size:10px;color:#51708c;text-transform:uppercase;letter-spacing:.05em}
  .kcell strong{font-size:16px}
  .tbl{width:100%;border-collapse:collapse;font-size:11.5px;margin:4px 0}
  .tbl th,.tbl td{padding:4px 7px;border-bottom:1px solid #e3e8ef;text-align:right;white-space:nowrap}
  .tbl th:first-child,.tbl td:first-child{text-align:left;white-space:normal}
  .tbl thead th{background:#0b2a4a;color:#fff}
  .tbl tr.grp td{background:#eef6f7;color:#0b2a4a;font-weight:700;text-align:left;font-size:11px;letter-spacing:.04em;text-transform:uppercase}
  .tbl tr.sub td{color:#51708c;font-style:italic}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .rimg{width:100%;height:auto;border:1px solid #e3e8ef;border-radius:6px}
  .rnote{color:#51708c;font-size:10.5px;margin:4px 0}
  .rsec p{margin:0 0 8px}
  .box{border:1.5px solid;border-radius:8px;padding:8px 12px}
  .box h3{background:none;padding:0;margin:0 0 6px;font-size:13px}
  .box ul{margin:0;padding-left:18px}.box li{margin-bottom:4px}
  .bull{border-color:#1f9d6b}.bull h3{color:#1f9d6b}.bear{border-color:#c2362b}.bear h3{color:#c2362b}
  .sw-s{border-color:#1f9d6b}.sw-s h3{color:#1f9d6b}.sw-w{border-color:#6b7a8c}.sw-w h3{color:#51708c}
  .sw-o{border-color:#2f6fcf}.sw-o h3{color:#2f6fcf}.sw-t{border-color:#d98e00}.sw-t h3{color:#b97800}
  .sig{list-style:none;padding:0;margin:0;columns:2;column-gap:18px}
  .sig li{padding:4px 0;border-bottom:1px solid #eef1f5;break-inside:avoid}
  .up{color:#1f9d6b;font-weight:700}.down{color:#c2362b;font-weight:700}.mid{color:#6b7a8c;font-weight:700}
  .news{border-bottom:1px solid #e3e8ef;padding:8px 0}
  .news a{color:#0a63c9;font-weight:700;text-decoration:underline}
  .news .meta{color:#51708c;font-size:11px}
  .tag{display:inline-block;padding:1px 8px;border-radius:999px;font-size:10.5px;font-weight:700;background:#eef1f5;margin-right:6px}
  .tag.pos{background:#e3f6ec;color:#1f9d6b}.tag.neg{background:#fde8e6;color:#c2362b}
  .disc{font-size:10.5px;color:#51708c}
  .pb{break-before:page}
  @media (max-width:640px){.kgrid{grid-template-columns:1fr 1fr}.two{grid-template-columns:1fr}.sig{columns:1}}
  @media print{.rsec{break-inside:avoid}}
  @page{size:A4;margin:10mm}`;

  const LOGO = '<svg viewBox="0 0 40 40" width="28" height="28" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#fff"/><circle cx="20" cy="17" r="7" fill="#ffb627"/><path d="M4 25q4-4 8 0t8 0 8 0 8 0" fill="none" stroke="#0fb5ba" stroke-width="2.4" stroke-linecap="round"/><path d="M6 31q4-4 8 0t8 0 8 0 6 0" fill="none" stroke="#ff6b5b" stroke-width="2.4" stroke-linecap="round"/></svg>';

  const news = [];
  let lastReport = null;   // { data, peers, form }

  /* ---------- utilidades DOM ---------- */
  function el(tag, props, kids) {
    const n = document.createElement(tag);
    Object.keys(props || {}).forEach((k) => { if (k === "text") n.textContent = props[k]; else if (k === "class") n.className = props[k]; else n.setAttribute(k, props[k]); });
    [].concat(kids || []).forEach((c) => { if (c !== null && c !== undefined && c !== false) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  const num = (v) => typeof v === "number" && isFinite(v);
  const dec = (v, d) => (num(v) ? v.toLocaleString("es-CO", { minimumFractionDigits: d, maximumFractionDigits: d }) : "n.d.");
  const val = (v) => (num(v) ? Math.abs(v) >= 100 ? fmt(v) : dec(v, 1) : "n.d.");
  const pc = (v) => (num(v) ? dec(v, 1) + "%" : "n.d.");
  const last = (a) => (a ? a[a.length - 1] : null);
  const field = (id) => ($(id) ? $(id).value.trim() : "");
  const lines = (txt) => txt.split(/\r?\n/).map((s) => s.replace(/^[\s\-•*]+/, "").trim()).filter(Boolean);
  function longDate(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); if (!m) return iso || "";
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
  }

  /* ---------- cálculos ---------- */
  function metrics(d) {
    const n = d.years.length, i = n - 1;
    const g = yoy(d.sales), gm = pctOf(d.grossProfit, d.sales), om = pctOf(d.operatingIncome, d.sales), nm = pctOf(d.netIncome, d.sales);
    const b = d.balance || {}, cf = d.cashflow || {};
    const at = (a) => (a ? a[i] : null);
    const div = (x, y) => (num(x) && num(y) && y !== 0 ? x / y : null);
    return {
      i, g, gm, om, nm,
      cagr: n >= 3 && d.sales[0] > 0 ? (Math.pow(d.sales[i] / d.sales[0], 1 / (n - 1)) - 1) * 100 : null,
      roe: num(div(d.netIncome[i], at(b.totalEquity))) ? div(d.netIncome[i], at(b.totalEquity)) * 100 : null,
      roa: num(div(d.netIncome[i], at(b.totalAssets))) ? div(d.netIncome[i], at(b.totalAssets)) * 100 : null,
      de: div(at(b.totalDebt), at(b.totalEquity)),
      cr: div(at(b.currentAssets), at(b.currentLiabilities)),
      cfoMargin: num(div(at(cf.operating), d.sales[i])) ? div(at(cf.operating), d.sales[i]) * 100 : null,
    };
  }

  function signals(d) {
    const m = metrics(d), i = m.i, out = [], add = (t, k) => out.push([k, t]);
    const prev = (a) => (a && i > 0 ? a[i - 1] : null);
    if (num(m.g[i])) add("Ingresos " + (m.g[i] >= 0 ? "crecieron " : "cayeron ") + pc(Math.abs(m.g[i])) + " en " + d.years[i] + " frente a " + d.years[i - 1] + ".", m.g[i] >= 0 ? "up" : "down");
    if (num(m.cagr)) add("Crecimiento anual compuesto de ingresos de " + pc(m.cagr) + " entre " + d.years[0] + " y " + d.years[i] + ".", m.cagr >= 0 ? "up" : "down");
    if (num(m.om[i])) add("Margen operacional de " + pc(m.om[i]) + (num(m.om[i - 1]) ? ", " + (m.om[i] >= m.om[i - 1] ? "por encima" : "por debajo") + " del " + pc(m.om[i - 1]) + " del año anterior" : "") + ".", m.om[i] >= 0 ? (num(m.om[i - 1]) && m.om[i] < m.om[i - 1] ? "mid" : "up") : "down");
    if (num(m.gm[i])) add("Margen bruto de " + pc(m.gm[i]) + (m.gm[i] < 20 ? ": relativamente bajo." : "."), m.gm[i] < 20 ? "down" : "up");
    const nis = d.netIncome.filter(num);
    if (nis.length) { const pos = nis.filter((v) => v > 0).length; add("Utilidad neta positiva en " + pos + " de " + nis.length + " años analizados.", pos === nis.length ? "up" : pos === 0 ? "down" : "mid"); }
    if (num(m.cr)) add("Razón corriente de " + dec(m.cr, 2) + (m.cr >= 1 ? ": los activos corrientes cubren los pasivos de corto plazo." : ": los pasivos de corto plazo superan los activos corrientes."), m.cr >= 1 ? "up" : "down");
    if (num(m.de)) add("Deuda financiera / patrimonio de " + dec(m.de, 2) + ".", m.de <= 1 ? "up" : "mid");
    if (num(m.cfoMargin)) add("El flujo de caja operativo equivale a " + pc(m.cfoMargin) + " de los ingresos.", m.cfoMargin > 0 ? "up" : "down");
    return out;
  }

  function autoSummary(d) {
    const m = metrics(d), i = m.i, cur = d.currency + " " + d.unit;
    let t = d.name + " (" + d.ticker + ") registró ingresos de " + val(d.sales[i]) + " (" + cur + ") en " + d.years[i];
    if (num(m.g[i])) t += ", " + (m.g[i] >= 0 ? "un aumento" : "una caída") + " de " + pc(Math.abs(m.g[i])) + " frente a " + d.years[i - 1];
    t += ". ";
    if (num(m.om[i])) t += "El margen operacional fue de " + pc(m.om[i]) + (num(m.om[i - 1]) ? " (" + pc(m.om[i - 1]) + " el año anterior)" : "") + ", ";
    if (num(m.nm[i])) t += (num(m.om[i]) ? "y " : "") + "el margen neto de " + pc(m.nm[i]) + ". ";
    else if (num(m.om[i])) t = t.replace(/, $/, ". ");
    if (num(m.cagr)) t += "Entre " + d.years[0] + " y " + d.years[i] + " los ingresos crecieron a una tasa anual compuesta de " + pc(m.cagr) + ". ";
    t += "Fuente de las cifras: " + d.source + ".";
    return t;
  }

  /* Borrador automático (reglas sobre las cifras): el analista lo edita y enriquece */
  function draftFields(d) {
    const sg = signals(d), pick = (k, n) => sg.filter((x) => x[0] === k).map((x) => x[1]).slice(0, n).join("\n");
    return { summary: autoSummary(d), bull: pick("up", 5), bear: pick("down", 5), s: pick("up", 3), w: pick("down", 3), o: "", t: "", call: "" };
  }
  function fillDrafts(d) {
    const f = draftFields(d);
    $("rp-analysis").value = commentary(d);
    [["rp-summary", f.summary], ["rp-bull", f.bull], ["rp-bear", f.bear], ["rp-sw-s", f.s], ["rp-sw-w", f.w], ["rp-sw-o", f.o], ["rp-sw-t", f.t], ["rp-call", f.call]].forEach(([id, v]) => ($(id).value = v));
    $("rp-sw-o").placeholder = "Complétalo con tu análisis del entorno, o usa «Redactar con IA».";
    $("rp-sw-t").placeholder = "Complétalo con tu análisis del entorno, o usa «Redactar con IA».";
  }


  /* ---------- análisis: ratios, vertical, horizontal, waterfall y comentario ---------- */
  const sub = (a, b) => (a && b ? a.map((v, k) => (num(v) && num(b[k]) ? v - b[k] : null)) : null);
  const ratio = (a, b, f) => (a && b ? a.map((v, k) => (num(v) && num(b[k]) && b[k] !== 0 ? v / b[k] * (f || 1) : null)) : null);
  const xf = (v) => (num(v) ? dec(v, 2) + "x" : "n.d.");
  const nsf = (v) => (num(v) ? (v > 0 ? "+" : "") + dec(v, 1) + "%" : "n.s.");   // n.s. = no significativo (base ≤ 0)
  const chg = (a) => (a ? a.map((v, k) => (k > 0 && num(v) && num(a[k - 1]) && a[k - 1] > 0 ? (v - a[k - 1]) / a[k - 1] * 100 : null)) : null);
  const vsBase = (a) => (a ? a.map((v, k) => (k > 0 && num(v) && num(a[0]) && a[0] > 0 ? (v - a[0]) / a[0] * 100 : null)) : null);

  function parts(d) {
    const b = d.balance || {}, cf = d.cashflow || {};
    return {
      cogs: sub(d.sales, d.grossProfit),                 // costo de ventas
      opex: sub(d.grossProfit, d.operatingIncome),       // gastos operativos (bruta − operacional)
      below: sub(d.operatingIncome, d.netIncome),        // financieros, impuestos y otros
      ncAssets: sub(b.totalAssets, b.currentAssets), ncLiab: sub(b.totalLiabilities, b.currentLiabilities),
      wc: sub(b.currentAssets, b.currentLiabilities), b, cf,
    };
  }

  function ratioRows(d) {
    const P = parts(d), b = P.b, cf = P.cf;
    return [
      { g: "Rentabilidad" },
      ["Margen bruto", ratio(d.grossProfit, d.sales, 100), pc],
      ["Margen operacional", ratio(d.operatingIncome, d.sales, 100), pc],
      ["Margen EBITDA", ratio(d.ebitda, d.sales, 100), pc],
      ["Margen neto", ratio(d.netIncome, d.sales, 100), pc],
      ["ROE (utilidad neta / patrimonio)", ratio(d.netIncome, b.totalEquity, 100), pc],
      ["ROA (utilidad neta / activos)", ratio(d.netIncome, b.totalAssets, 100), pc],
      { g: "Liquidez" },
      ["Razón corriente", ratio(b.currentAssets, b.currentLiabilities), xf],
      ["Capital de trabajo", P.wc, val],
      { g: "Endeudamiento" },
      ["Pasivos / activos", ratio(b.totalLiabilities, b.totalAssets, 100), pc],
      ["Pasivos / patrimonio", ratio(b.totalLiabilities, b.totalEquity), xf],
      ["Deuda financiera / patrimonio", ratio(b.totalDebt, b.totalEquity), xf],
      ["Deuda financiera / EBITDA", ratio(b.totalDebt, d.ebitda), xf],
      { g: "Eficiencia y caja" },
      ["Rotación de activos (ingresos / activos)", ratio(d.sales, b.totalAssets), xf],
      ["Flujo operativo / ingresos", ratio(cf.operating, d.sales, 100), pc],
      ["Flujo operativo / utilidad neta", ratio(cf.operating, d.netIncome), xf],
    ];
  }
  function verticalRows(d) {
    const P = parts(d), b = P.b, S = d.sales, A = b.totalAssets, r = (a, base) => ratio(a, base, 100);
    return {
      pl: [["Ingresos", r(S, S), pc], ["(−) Costo de ventas", r(P.cogs, S), pc], ["Utilidad bruta", r(d.grossProfit, S), pc], ["(−) Gastos operativos", r(P.opex, S), pc],
        ["Utilidad operacional", r(d.operatingIncome, S), pc], ["(−) Financieros, impuestos y otros", r(P.below, S), pc], ["Utilidad neta", r(d.netIncome, S), pc]],
      bs: [["Activos corrientes", r(b.currentAssets, A), pc], ["Activos no corrientes", r(P.ncAssets, A), pc], ["Pasivos corrientes", r(b.currentLiabilities, A), pc],
        ["Pasivos no corrientes", r(P.ncLiab, A), pc], ["Patrimonio", r(b.totalEquity, A), pc], ["Deuda financiera", r(b.totalDebt, A), pc]],
    };
  }
  function horizontalRows(d) {
    const P = parts(d), b = P.b, cf = P.cf;
    const L = [["Ingresos", d.sales], ["Utilidad bruta", d.grossProfit], ["Utilidad operacional", d.operatingIncome], ["EBITDA", d.ebitda], ["Utilidad neta", d.netIncome],
      ["Activos totales", b.totalAssets], ["Pasivos totales", b.totalLiabilities], ["Patrimonio", b.totalEquity], ["Flujo de operación", cf.operating]];
    return { yoy: L.map(([l, a]) => [l, chg(a), nsf]), base: L.map(([l, a]) => [l, vsBase(a), nsf]) };
  }

  function tableG(d, rows) {
    const t = el("table", { class: "tbl" });
    t.appendChild(el("thead", {}, el("tr", {}, [el("th", { text: "Concepto" })].concat(d.years.map((y) => el("th", { text: y }))))));
    const tb = el("tbody"); let pendingG = null, count = 0;
    rows.forEach((r) => {
      if (!Array.isArray(r)) { pendingG = r.g; return; }
      const [label, arr, f] = r; if (!arr || !arr.some(num)) return;
      if (pendingG) { tb.appendChild(el("tr", { class: "grp" }, [el("td", { text: pendingG, colspan: String(d.years.length + 1) })])); pendingG = null; }
      tb.appendChild(el("tr", {}, [el("td", { text: label })].concat(arr.map((v) => el("td", { text: f(v) }))))); count++;
    });
    if (!count) return null;
    t.appendChild(tb); return t;
  }

  /* Cascada del último año: ingresos → utilidad neta (imagen para el informe) */
  function waterfallImg(d) {
    const i = d.years.length - 1, P = parts(d);
    const steps = [["Ingresos", d.sales[i], "total"], ["Costo de ventas", num(P.cogs && P.cogs[i]) ? -P.cogs[i] : null, "delta"], ["Utilidad bruta", d.grossProfit[i], "total"],
      ["Gastos operativos", num(P.opex && P.opex[i]) ? -P.opex[i] : null, "delta"], ["Utilidad oper.", d.operatingIncome[i], "total"],
      ["Financ., impuestos y otros", num(P.below && P.below[i]) ? -P.below[i] : null, "delta"], ["Utilidad neta", d.netIncome[i], "total"]].filter((s) => num(s[1]));
    if (steps.length < 4) return null;
    const W = 640, H = 300, sc = 2, cv = document.createElement("canvas"); cv.width = W * sc; cv.height = H * sc;
    const x = cv.getContext("2d"); x.scale(sc, sc); x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
    let run = 0; const bars = steps.map(([l, v, k]) => { let lo, hi; if (k === "total") { lo = Math.min(0, v); hi = Math.max(0, v); run = v; } else { const a = run, b2 = run + v; lo = Math.min(a, b2); hi = Math.max(a, b2); run = b2; } return { l, v, k, lo, hi }; });
    const mx = Math.max(...bars.map((b2) => b2.hi), 0), mn = Math.min(...bars.map((b2) => b2.lo), 0), padT = 26, padB = 44, padL = 12, ph = H - padT - padB, sp = (mx - mn) || 1;
    const Y = (v) => padT + (mx - v) / sp * ph, bw = (W - padL * 2) / bars.length;
    x.strokeStyle = "#c9d3df"; x.beginPath(); x.moveTo(padL, Y(0)); x.lineTo(W - padL, Y(0)); x.stroke();
    x.textAlign = "center"; x.font = "11px Segoe UI, Arial";
    bars.forEach((b2, n) => {
      const bx = padL + n * bw + bw * 0.16, w = bw * 0.68, y1 = Y(b2.hi), y2 = Y(b2.lo);
      x.fillStyle = b2.k === "total" ? (b2.v >= 0 ? "#0fb5ba" : "#c2362b") : (b2.v >= 0 ? "#1f9d6b" : "#ff6b5b");
      x.fillRect(bx, y1, w, Math.max(2, y2 - y1));
      x.fillStyle = "#0b2a4a"; x.fillText((b2.v < 0 && b2.k === "delta" ? "−" : "") + val(Math.abs(b2.v)), bx + w / 2, y1 - 6);
      x.fillStyle = "#51708c"; const words = b2.l.split(" "), mid = Math.ceil(words.length / 2);
      x.fillText(words.slice(0, mid).join(" "), bx + w / 2, H - 28); if (words.length > 1) x.fillText(words.slice(mid).join(" "), bx + w / 2, H - 14);
    });
    return el("img", { class: "rimg", src: cv.toDataURL("image/png"), alt: "Cascada del estado de resultados " + d.years[i] });
  }

  /* Comentario automático (reglas sobre las cifras). El analista lo edita. */
  function commentary(d) {
    const m = metrics(d), i = m.i, y = d.years, P = parts(d), b = P.b, cf = P.cf, out = [];
    const pcs = (v) => pc(Math.abs(v));
    const S = ratio(d.sales, d.sales, 100);
    if (num(m.g[i]) && num(m.g[i - 1])) out.push("Ingresos: " + (m.g[i] >= 0 ? "crecen " : "caen ") + pcs(m.g[i]) + " en " + y[i] + ", tras " + (m.g[i - 1] >= 0 ? "un alza de " : "una caída de ") + pcs(m.g[i - 1]) + " en " + y[i - 1] + ".");
    else if (num(m.g[i])) out.push("Ingresos: " + (m.g[i] >= 0 ? "crecen " : "caen ") + pcs(m.g[i]) + " en " + y[i] + ".");
    const cg = ratio(P.cogs, d.sales, 100), og = ratio(P.opex, d.sales, 100);
    if (num(cg && cg[i]) && num(cg[0])) out.push("Análisis vertical: el costo de ventas pasó de " + pc(cg[0]) + " de los ingresos en " + y[0] + " a " + pc(cg[i]) + " en " + y[i] + (cg[i] > cg[0] ? ", lo que presiona el margen bruto." : ", lo que favorece el margen bruto."));
    if (num(og && og[i]) && num(og[0])) out.push("Los gastos operativos representan " + pc(og[i]) + " de los ingresos en " + y[i] + " (" + pc(og[0]) + " en " + y[0] + ").");
    if (num(m.om[i]) && num(m.om[0])) out.push("Margen operacional: " + pc(m.om[0]) + " en " + y[0] + " → " + pc(m.om[i]) + " en " + y[i] + (m.om[i] < 0 ? " (la operación genera pérdida)." : "."));
    const nh = d.netIncome.filter(num); if (nh.length >= 2) { const f = nh[0], l = nh[nh.length - 1]; out.push("Análisis horizontal: la utilidad neta pasa de " + val(f) + " a " + val(l) + " (" + d.currency + " " + d.unit + ") entre " + y[0] + " y " + y[i] + (f > 0 ? ", " + nsf((l - f) / f * 100) + " frente al año base." : "; con base negativa el cambio porcentual no es significativo.")); }
    const cr = ratio(b.currentAssets, b.currentLiabilities); if (cr && num(cr[i])) out.push("Liquidez: razón corriente de " + xf(cr[i]) + " en " + y[i] + (num(cr[0]) ? " (" + xf(cr[0]) + " en " + y[0] + ")" : "") + (cr[i] >= 1 ? ": cubre las obligaciones de corto plazo." : ": no cubre las obligaciones de corto plazo."));
    const pa = ratio(b.totalLiabilities, b.totalAssets, 100); if (pa && num(pa[i])) out.push("Endeudamiento: los pasivos financian " + pc(pa[i]) + " de los activos en " + y[i] + (num(pa[0]) ? " (" + pc(pa[0]) + " en " + y[0] + ")." : "."));
    const roe = ratio(d.netIncome, b.totalEquity, 100); if (roe && num(roe[i])) out.push("Rentabilidad del patrimonio (ROE) de " + pc(roe[i]) + " en " + y[i] + ".");
    if (cf.operating && num(cf.operating[i])) out.push("Caja: el flujo operativo de " + y[i] + " fue " + (cf.operating[i] >= 0 ? "positivo" : "negativo") + " (" + val(cf.operating[i]) + ")" + (num(d.netIncome[i]) ? ", frente a una utilidad neta de " + val(d.netIncome[i]) + "." : "."));
    if (!b.totalAssets) out.push("Balance y flujo de caja no están en la fuente cargada, por lo que no se calculan ratios de liquidez, deuda ni ROE.");
    return out.join("\n");
  }


  /* ---------- persistencia: análisis guardados en la base de datos local ---------- */
  const FMK = new Map([[pc, "pc"], [xf, "xf"], [val, "val"], [nsf, "nsf"]]), FMF = { pc, xf, val, nsf };
  const ser = (rows) => rows.map((r) => (Array.isArray(r) ? { l: r[0], v: r[1], f: FMK.get(r[2]) || "val" } : r));
  const deser = (rows) => rows.map((r) => (r.l !== undefined ? [r.l, r.v, FMF[r.f] || val] : r));
  const stampOf = (d) => d.ticker + "|" + d.years.join(",") + "|" + JSON.stringify([d.sales, d.netIncome, d.balance && d.balance.totalAssets]);
  const KINDS = { v: "vertical", h: "horizontal", r: "ratios" };
  function computeAn(kind, d) {
    const base = { kind, stamp: stampOf(d), years: d.years, currency: d.currency, unit: d.unit };
    if (kind === "vertical") { const V = verticalRows(d); return Object.assign(base, { pl: ser(V.pl), bs: ser(V.bs) }); }
    if (kind === "horizontal") { const H = horizontalRows(d); return Object.assign(base, { yoy: ser(H.yoy), base: ser(H.base) }); }
    return Object.assign(base, { rows: ser(ratioRows(d)) });
  }
  async function getAn(kind, d, force) {
    const key = d.ticker + "|" + kind, rec = force ? null : await Store.get("analysis", key);
    if (rec && rec.value && rec.value.stamp === stampOf(d)) return rec.value;
    const v = computeAn(kind, d); await Store.put("analysis", key, v); return v;
  }
  const hhmm = (iso) => new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  async function refreshChips() {
    const t = TICKER_GLOBAL, d = state.data;
    const set = (id, rec, ok) => { const c = $(id); if (!c) return; c.className = "chip" + (ok ? " ok" : ""); c.textContent = ok ? "✓ guardado " + hhmm(rec.updated) : "pendiente"; };
    if (!t) { ["chip-d", "chip-v", "chip-h", "chip-r"].forEach((i) => set(i, null, false)); return; }
    const f = await Store.get("financials", t); set("chip-d", f, !!f);
    for (const k of ["v", "h", "r"]) { const rec = d ? await Store.get("analysis", d.ticker + "|" + KINDS[k]) : null; set("chip-" + k, rec, !!(rec && rec.value && d && rec.value.stamp === stampOf(d))); }
  }
  async function ensureData(force) {
    if (state.data && !force && state.data.ticker && (state.dataFor === TICKER_GLOBAL)) return true;
    if (!TICKER_GLOBAL) { setStatus($("report-status"), "Primero elige y envía un ticker (paso 2).", "bad"); return false; }
    const ok = await loadFinancials(force); if (ok) state.dataFor = TICKER_GLOBAL;
    if (!ok) setStatus($("report-status"), "No se pudieron cargar los estados: " + $("action-status").textContent, "bad");
    return ok;
  }
  async function runAnalysis(kind) {
    setStatus($("report-status"), "Calculando " + kind + "…");
    if (!(await ensureData(false))) return;
    const d = state.data, v = await getAn(kind, d, true), box = $("an-preview"); box.replaceChildren();
    const T = (title, rows) => { const t = tableG(d, deser(rows)); if (t) { box.appendChild(el("h3", { text: title })); box.appendChild(t); } };
    if (kind === "vertical") { T("Vertical — estado de resultados (% de los ingresos)", v.pl); T("Vertical — balance (% de los activos)", v.bs); }
    else if (kind === "horizontal") { T("Horizontal — variación anual (%)", v.yoy); T("Horizontal — variación frente al año base (%)", v.base); }
    else T("Ratios clave por año", v.rows);
    if (!box.firstChild) box.appendChild(el("p", { class: "rnote", text: "La fuente no trae datos suficientes para este análisis." }));
    await refreshChips(); refreshDb();
    setStatus($("report-status"), "Análisis " + kind + " guardado en la base de datos. El informe lo leerá de ahí.", "ok");
  }
  async function refreshDb() {
    const box = $("db-list"); if (!box) return; box.replaceChildren();
    const all = await Store.list();
    if (!all.length) { box.appendChild(el("p", { class: "rnote", text: "Aún no hay registros guardados." })); return; }
    all.forEach((r) => {
      const b = el("button", { type: "button", class: "btn small", text: "Quitar" });
      b.addEventListener("click", async () => { await Store.del(r.table, r.key); refreshDb(); refreshChips(); });
      box.appendChild(el("div", { class: "news-item" }, [el("span", { text: r.table + " · " + r.key + " · " + new Date(r.updated).toLocaleString("es-CO") + " · " + Math.round(r.bytes / 1024 * 10) / 10 + " KB" }), b]));
    });
  }

  /* ---------- bloques del informe ---------- */
  function kcell(label, value, manual) { return el("div", { class: "kcell" + (manual ? " m" : "") }, [el("span", { text: label }), el("strong", { text: value })]); }

  function table(d, rows, headExtra) {
    const t = el("table", { class: "tbl" });
    const hr = el("tr", {}, [el("th", { text: "Concepto" })].concat(d.years.map((y) => el("th", { text: y }))));
    t.appendChild(el("thead", {}, hr));
    const tb = el("tbody");
    rows.forEach(([label, arr, f, sub]) => { if (!arr || !arr.some(num)) return; tb.appendChild(el("tr", sub ? { class: "sub" } : {}, [el("td", { text: label })].concat(arr.map((v) => el("td", { text: f(v) }))))); });
    t.appendChild(tb); return t;
  }
  const hasAny = (...arrs) => arrs.some((a) => a && a.some(num));

  function chartImg(model, label) {
    const cv = document.createElement("canvas");
    paintChart(cv, model, { theme: "light", width: 640, scale: 2 });
    return el("img", { class: "rimg", src: cv.toDataURL("image/png"), alt: label });
  }

  async function peerRows(d, tickers) {
    const rows = [d];
    const notes = [];
    for (const t of tickers) {
      try { const p = await fetchFinancials(t); p._t = t; rows.push(p); } catch (e) { notes.push(t + ": " + e.message); }
    }
    return { rows, notes };
  }

  async function buildReport() {
    const d = state.data; if (!d) return null;
    const m = metrics(d), i = m.i, cur = d.currency + " " + d.unit;
    const form = {
      date: field("rp-date"), author: field("rp-author"),
      market: { price: field("rp-price"), mcap: field("rp-mcap"), pe: field("rp-pe"), eps: field("rp-eps"), range: field("rp-range"), yield: field("rp-yield"), consensus: field("rp-consensus"), target: field("rp-target") },
      peers: field("rp-peers").split(/[\s,;]+/).map((s) => s.toUpperCase()).filter((s) => /^[A-Z][A-Z0-9.\-]{0,5}$/.test(s)).slice(0, 5),
      summary: field("rp-summary"), analysis: field("rp-analysis"), bull: field("rp-bull"), bear: field("rp-bear"),
      swot: { s: field("rp-sw-s"), w: field("rp-sw-w"), o: field("rp-sw-o"), t: field("rp-sw-t") }, call: field("rp-call"),
    };
    if (!form.summary) { form.summary = autoSummary(d); $("rp-summary").value = form.summary; }
    const root = el("article", { class: "report", id: "report-article" });

    // Encabezado y título
    const head = el("div", { class: "r-head" });
    head.innerHTML = '<div class="r-brand">' + LOGO + '<span>VCC50000 Insight</span></div><small>Informe de análisis financiero</small>';
    root.appendChild(head);
    root.appendChild(el("div", { class: "r-title" }, [
      el("h1", { text: d.name + " (" + d.ticker + ")" }),
      el("p", { text: "Fecha del informe: " + longDate(form.date) + (form.author ? " · Preparado por " + form.author : "") + " · Cifras en " + cur + " · Fuente: " + d.source }),
    ]));
    if (d.notice) root.appendChild(el("div", { class: "rsec" }, el("p", { class: "rnote", text: "Nota: " + d.notice })));

    // Indicadores clave
    const k = el("div", { class: "kgrid" });
    k.append(kcell("Ingresos " + d.years[i], val(d.sales[i])), kcell("Crecimiento anual", pc(m.g[i])), kcell("Margen bruto", pc(m.gm[i])),
      kcell("Margen operacional", pc(m.om[i])), kcell("Margen neto", pc(m.nm[i])), kcell("CAGR ingresos", pc(m.cagr)));
    if (d.ebitda && num(d.ebitda[i])) k.appendChild(kcell("EBITDA (calculado)", val(d.ebitda[i])));
    if (d.eps && num(d.eps[i])) k.appendChild(kcell("EPS diluido", dec(d.eps[i], 2)));
    if (num(m.roe)) k.appendChild(kcell("ROE", pc(m.roe)));
    if (num(m.roa)) k.appendChild(kcell("ROA", pc(m.roa)));
    if (num(m.de)) k.appendChild(kcell("Deuda / patrimonio", dec(m.de, 2)));
    if (num(m.cr)) k.appendChild(kcell("Razón corriente", dec(m.cr, 2)));
    const mk = form.market, mrows = [["Precio de la acción", mk.price], ["Capitalización", mk.mcap], ["P/E", mk.pe], ["EPS (digitado)", mk.eps], ["Rango 52 semanas", mk.range], ["Rendimiento por dividendo", mk.yield], ["Consenso de analistas", mk.consensus], ["Precio objetivo", mk.target]].filter((r) => r[1]);
    mrows.forEach(([l, v]) => k.appendChild(kcell(l, v, true)));
    const s1 = el("section", { class: "rsec" }, [el("h2", { text: "Indicadores clave" }), k]);
    if (mrows.length) s1.appendChild(el("p", { class: "rnote", text: "Los indicadores con borde amarillo fueron digitados por el analista; no provienen de la fuente de estados financieros." }));
    root.appendChild(s1);

    // Resumen ejecutivo
    root.appendChild(el("section", { class: "rsec" }, [el("h2", { text: "Resumen ejecutivo" })].concat(form.summary.split(/\n{2,}|\r?\n/).filter(Boolean).map((p) => el("p", { text: p })))));

    // Señales automáticas
    const sg = signals(d);
    if (sg.length) root.appendChild(el("section", { class: "rsec" }, [el("h2", { text: "Señales automáticas" }),
      el("ul", { class: "sig" }, sg.map(([c, t]) => el("li", {}, [el("span", { class: c, text: c === "up" ? "▲ " : c === "down" ? "▼ " : "● " }), t]))),
      el("p", { class: "rnote", text: "Reglas calculadas sobre las cifras cargadas; no constituyen una recomendación." })]));

    // Gráficas
    const g1 = buildModel("ingresos", d), g2 = buildModel("margenes", d);
    root.appendChild(el("section", { class: "rsec" }, [el("h2", { text: "Evolución de ingresos y márgenes" }),
      el("div", { class: "two" }, [chartImg(g1, "Ingresos y utilidades"), chartImg(g2, "Márgenes")]),
      el("p", { class: "rnote", text: "Izquierda: ingresos y utilidades (" + cur + "). Derecha: márgenes como % de los ingresos." })]));

    // Análisis (P&G, ratios, vertical, horizontal)
    {
      const an = el("section", { class: "rsec" }, [el("h2", { text: "Análisis financiero" })]);
      const wf = waterfallImg(d);
      if (wf) { an.appendChild(el("h3", { text: "Del ingreso a la utilidad neta, " + d.years[i] })); an.appendChild(wf); }
      if (form.analysis) { an.appendChild(el("h3", { text: "Lectura del analista" })); lines(form.analysis).forEach((p) => an.appendChild(el("p", { text: p }))); }
      const R = await getAn("ratios", d), V = await getAn("vertical", d), H = await getAn("horizontal", d);   // se leen de la base de datos (o se calculan y guardan si faltan)
      const rt = tableG(d, deser(R.rows)); if (rt) { an.appendChild(el("h3", { text: "Ratios financieros por año" })); an.appendChild(rt); }
      const vp = tableG(d, deser(V.pl)), vb = tableG(d, deser(V.bs));
      if (vp) { an.appendChild(el("h3", { text: "Análisis vertical — estado de resultados (% de los ingresos)" })); an.appendChild(vp); }
      if (vb) { an.appendChild(el("h3", { text: "Análisis vertical — balance (% de los activos totales)" })); an.appendChild(vb); }
      const hy = tableG(d, deser(H.yoy)), hb = tableG(d, deser(H.base));
      if (hy) { an.appendChild(el("h3", { text: "Análisis horizontal — variación anual (%)" })); an.appendChild(hy); }
      if (hb) { an.appendChild(el("h3", { text: "Análisis horizontal — variación frente al año base " + d.years[0] + " (%)" })); an.appendChild(hb); }
      an.appendChild(el("p", { class: "rnote", text: "Costo de ventas = ingresos − utilidad bruta; gastos operativos = utilidad bruta − utilidad operacional; «financieros, impuestos y otros» = utilidad operacional − utilidad neta. n.s. = no significativo (base cero o negativa); n.d. = no disponible en la fuente." }));
      root.appendChild(an);
    }

    // Estados financieros
    const sec = el("section", { class: "rsec" }, [el("h2", { text: "Estados financieros" })]);
    const b = d.balance || {}, cf = d.cashflow || {};
    sec.appendChild(el("h3", { text: "Estado de resultados" }));
    sec.appendChild(table(d, [["Ingresos", d.sales, val], ["Utilidad bruta", d.grossProfit, val], ["Utilidad operacional", d.operatingIncome, val], ["EBITDA (calculado)", d.ebitda, val],
      ["Utilidad neta", d.netIncome, val], ["EPS diluido", d.eps, (v) => dec(v, 2)], ["Margen bruto", m.gm, pc, true], ["Margen operacional", m.om, pc, true], ["Margen neto", m.nm, pc, true], ["Crecimiento de ingresos", m.g, pc, true]]));
    sec.appendChild(el("h3", { text: "Balance general" }));
    if (hasAny(b.totalAssets, b.totalEquity, b.totalLiabilities, b.currentAssets)) sec.appendChild(table(d, [["Activos corrientes", b.currentAssets, val], ["Activos totales", b.totalAssets, val], ["Pasivos corrientes", b.currentLiabilities, val],
      ["Pasivos totales", b.totalLiabilities, val], ["Patrimonio", b.totalEquity, val], ["Deuda financiera", b.totalDebt, val]]));
    else sec.appendChild(el("p", { class: "rnote", text: "No disponible en la fuente cargada. Con la consulta a la SEC aparece cuando la compañía lo reporta en XBRL." }));
    sec.appendChild(el("h3", { text: "Flujo de caja" }));
    if (hasAny(cf.operating, cf.investing, cf.financing)) sec.appendChild(table(d, [["Flujo de operación", cf.operating, val], ["Flujo de inversión", cf.investing, val], ["Flujo de financiación", cf.financing, val]]));
    else sec.appendChild(el("p", { class: "rnote", text: "No disponible en la fuente cargada." }));
    sec.appendChild(el("p", { class: "rnote", text: "Cifras en " + cur + (d.currency === "USD" ? ", salvo EPS (USD por acción)" : "") + ". EBITDA = utilidad operacional + depreciación y amortización cuando ambas están disponibles. n.d. = no disponible." }));
    root.appendChild(sec);

    // Pares
    if (form.peers.length) {
      const { rows, notes } = await peerRows(d, form.peers);
      const t = el("table", { class: "tbl" });
      t.appendChild(el("thead", {}, el("tr", {}, ["Compañía", "Moneda", "Ingresos", "Crec. anual", "Margen bruto", "Margen oper.", "Margen neto", "CAGR"].map((h) => el("th", { text: h })))));
      const tb = el("tbody");
      rows.forEach((p) => { const q = metrics(p), j = q.i;
        tb.appendChild(el("tr", {}, [(p.ticker || p._t) + " · " + p.name, p.currency + " " + p.unit, val(p.sales[j]), pc(q.g[j]), pc(q.gm[j]), pc(q.om[j]), pc(q.nm[j]), pc(q.cagr)].map((x, n) => el("td", { text: x })))); });
      t.appendChild(tb);
      form.peerRows = rows.map((p) => p.ticker);
      root.appendChild(el("section", { class: "rsec" }, [el("h2", { text: "Comparativo con pares" }), t,
        el("p", { class: "rnote", text: "Los márgenes son comparables entre compañías; los montos solo si la moneda y la unidad coinciden. Último año disponible de cada una." + (notes.length ? " Sin datos: " + notes.join(" | ") : "") })]));
    }

    // Insights
    const bull = lines(form.bull), bear = lines(form.bear);
    if (bull.length || bear.length) root.appendChild(el("section", { class: "rsec" }, [el("h2", { text: "Insights" }), el("div", { class: "two" }, [
      bull.length ? el("div", { class: "box bull" }, [el("h3", { text: "▲ Caso favorable" }), el("ul", {}, bull.map((x) => el("li", { text: x })))]) : null,
      bear.length ? el("div", { class: "box bear" }, [el("h3", { text: "▼ Caso adverso" }), el("ul", {}, bear.map((x) => el("li", { text: x })))]) : null])]));
    const sw = form.swot, any = sw.s || sw.w || sw.o || sw.t;
    if (any) root.appendChild(el("section", { class: "rsec" }, [el("h2", { text: "Análisis SWOT" }), el("div", { class: "two" },
      [["sw-s", "Fortalezas", sw.s], ["sw-w", "Debilidades", sw.w], ["sw-o", "Oportunidades", sw.o], ["sw-t", "Amenazas", sw.t]].filter((q) => q[2]).map(([c, t, x]) =>
        el("div", { class: "box " + c }, [el("h3", { text: t }), el("ul", {}, lines(x).map((y) => el("li", { text: y })))])))]));
    if (form.call) root.appendChild(el("section", { class: "rsec" }, [el("h2", { text: "Llamada de resultados" })].concat(lines(form.call).length ? [el("ul", {}, lines(form.call).map((x) => el("li", { text: x })))] : [])));

    // Noticias
    if (news.length) root.appendChild(el("section", { class: "rsec" }, [el("h2", { text: "Noticias relevantes" })].concat(news.map((n) => el("div", { class: "news" }, [
      /^https?:\/\//i.test(n.url) ? el("a", { href: n.url, target: "_blank", rel: "noopener noreferrer", text: n.title }) : el("strong", { text: n.title }),
      el("div", { class: "meta", text: longDate(n.date) }),
      n.text ? el("p", { text: n.text }) : null,
      el("div", {}, [el("span", { class: "tag", text: "Importancia " + n.imp + "/10" }), el("span", { class: "tag " + (n.sent === "Positivo" ? "pos" : n.sent === "Negativo" ? "neg" : ""), text: n.sent })])])))));

    // Aviso legal
    root.appendChild(el("section", { class: "rsec disc" }, [el("h2", { text: "Aviso legal" }),
      el("p", { text: "Este informe es un resumen con fines informativos generales y no constituye asesoría de inversión, legal, tributaria o contable, ni una recomendación de comprar o vender un valor. Las cifras provienen de la fuente indicada (SEC EDGAR, estados financieros en PDF u otros datos digitados por el analista) y no han sido verificadas de forma independiente; pueden diferir de los filings oficiales. Los textos de resumen, insights y SWOT pueden haber sido redactados o editados por el analista o con ayuda de herramientas de inteligencia artificial. VCC50000 no asume responsabilidad por decisiones tomadas con base en este informe. Verifica siempre las cifras contra el filing oficial." })]));
    lastReport = { data: d, form: form };
    return root;
  }

  /* ---------- descargas ---------- */
  function standalone() {
    const node = $("report-view").querySelector(".report"); if (!node) return "";
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' +
      (state.data ? state.data.ticker + " — " : "") + 'VCC50000 Insight</title><style>body{margin:0;background:#eef1f5}.report{max-width:900px;margin:0 auto}' + REPORT_CSS + '@media print{body{background:#fff}.report{max-width:none;border:0}}</style></head><body>' + node.outerHTML + "</body></html>";
  }
  function save(name, text, type) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const fname = (ext) => "VCC50000_Insight_" + (state.data ? state.data.ticker : "informe") + "_" + new Date().toISOString().slice(0, 10) + "." + ext;
  function csv() {
    const d = state.data, m = metrics(d), b = d.balance || {}, cf = d.cashflow || {};
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const rows = [["Compañía", d.name], ["Ticker", d.ticker], ["Moneda y unidad", d.currency + " " + d.unit], ["Fuente", d.source], [], ["Concepto"].concat(d.years)];
    [["Ingresos", d.sales], ["Utilidad bruta", d.grossProfit], ["Utilidad operacional", d.operatingIncome], ["EBITDA (calculado)", d.ebitda], ["Utilidad neta", d.netIncome], ["EPS diluido", d.eps],
      ["Margen bruto %", m.gm], ["Margen operacional %", m.om], ["Margen neto %", m.nm], ["Crecimiento ingresos %", m.g], ["Activos corrientes", b.currentAssets], ["Activos totales", b.totalAssets],
      ["Pasivos corrientes", b.currentLiabilities], ["Pasivos totales", b.totalLiabilities], ["Patrimonio", b.totalEquity], ["Deuda financiera", b.totalDebt],
      ["Flujo de operación", cf.operating], ["Flujo de inversión", cf.investing], ["Flujo de financiación", cf.financing]]
      .forEach(([l, a]) => { if (a) rows.push([l].concat(a.map((v) => (num(v) ? v : "")))); });
    rows.push([], ["RATIOS"]); ratioRows(d).forEach((r) => { if (Array.isArray(r) && r[1]) rows.push([r[0]].concat(r[1].map((v) => (num(v) ? Math.round(v * 100) / 100 : "")))); });
    const V = verticalRows(d); rows.push([], ["ANÁLISIS VERTICAL P&G (% ingresos)"]); V.pl.forEach((r) => { if (r[1]) rows.push([r[0]].concat(r[1].map((v) => (num(v) ? Math.round(v * 10) / 10 : "")))); });
    const H = horizontalRows(d); rows.push([], ["ANÁLISIS HORIZONTAL (variación anual %)"]); H.yoy.forEach((r) => { if (r[1] && r[1].some(num)) rows.push([r[0]].concat(r[1].map((v) => (num(v) ? Math.round(v * 10) / 10 : "")))); });
    return "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n");
  }
  function printPdf() {
    const html = standalone(); if (!html) return;
    let f = $("print-frame"); if (f) f.remove();
    f = el("iframe", { id: "print-frame", title: "Impresión del informe", style: "position:fixed;right:0;bottom:0;width:0;height:0;border:0" });
    document.body.appendChild(f);
    f.onload = () => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (_) { setStatus($("report-status"), "No se pudo abrir la impresión. Descarga el HTML y usa Imprimir > Guardar como PDF.", "bad"); } };
    f.srcdoc = html;
  }
  function claudePrompt() {
    const d = state.data, m = metrics(d);
    return "Eres analista financiero. Con los datos de abajo de " + d.name + " (" + d.ticker + "), redacta en español para un informe corporativo: (1) resumen ejecutivo de 2 párrafos, (2) caso favorable y caso adverso (4 viñetas cada uno), (3) SWOT (3 viñetas por cuadrante). " +
      "Usa SOLO las cifras entregadas; si afirmas algo externo, cita la fuente con enlace y fecha; si no tienes sustento, dilo. No inventes cifras, segmentos ni noticias. Una idea por línea, sin numeración.\n\nDATOS (" + d.currency + " " + d.unit + "; fuente: " + d.source + "):\n" +
      JSON.stringify({ years: d.years, ingresos: d.sales, utilidadBruta: d.grossProfit, utilidadOperacional: d.operatingIncome, utilidadNeta: d.netIncome, ebitda: d.ebitda || null,
        margenOperacionalPct: m.om.map((v) => (num(v) ? Math.round(v * 10) / 10 : null)), margenNetoPct: m.nm.map((v) => (num(v) ? Math.round(v * 10) / 10 : null)), balance: d.balance || null, flujoCaja: d.cashflow || null });
  }

  /* Para compartir por WhatsApp: HTML del informe visible y un mensaje corto con las cifras clave */
  window.getReportForShare = function () {
    const d = state.data; if (!d || !$("report-view").querySelector(".report")) return null;
    const m = metrics(d), i = m.i;
    const text = "VCC50000 Insight — " + d.name + " (" + d.ticker + ")\nIngresos " + d.years[i] + ": " + d.currency + " " + val(d.sales[i]) + " " + d.unit + (num(m.g[i]) ? " (" + (m.g[i] >= 0 ? "+" : "") + dec(m.g[i], 1) + "% anual)" : "") +
      "\nMargen operacional: " + pc(m.om[i]) + " · Margen neto: " + pc(m.nm[i]);
    return { ticker: TICKER_GLOBAL, html: standalone(), text };
  };

  /* ---------- noticias (objetos repetibles) ---------- */
  function renderNews() {
    const box = $("news-list"); box.replaceChildren();
    news.forEach((n, idx) => {
      const b = el("button", { type: "button", class: "btn small", text: "Quitar" });
      b.addEventListener("click", () => { news.splice(idx, 1); renderNews(); });
      box.appendChild(el("div", { class: "news-item" }, [el("span", { text: n.date + " · " + n.title + " (" + n.sent + ", " + n.imp + "/10)" }), b]));
    });
  }
  function addNews() {
    const title = field("rp-n-title"), url = field("rp-n-url"), imp = Math.min(10, Math.max(1, parseInt(field("rp-n-imp"), 10) || 5));
    if (!title) { setStatus($("report-status"), "Escribe el titular de la noticia.", "bad"); return; }
    if (url && !/^https?:\/\//i.test(url)) { setStatus($("report-status"), "El enlace debe empezar por http:// o https://", "bad"); return; }
    news.push({ title, url, imp, date: field("rp-n-date") || new Date().toISOString().slice(0, 10), sent: $("rp-n-sent").value, text: field("rp-n-text") });
    ["rp-n-title", "rp-n-url", "rp-n-text"].forEach((id) => ($(id).value = ""));
    setStatus($("report-status"), "Noticia agregada.", "ok"); renderNews();
  }

  /* Datos básicos del ticker, visibles en cuanto hay datos (antes del informe) */
  function renderBasics(d) {
    const m = metrics(d), i = m.i, box = $("rp-basics"); box.replaceChildren();
    const g = el("div", { class: "kgrid" });
    [["Compañía", d.name + " (" + d.ticker + ")"], ["Moneda y unidad", d.currency + " " + d.unit], ["Años", d.years[0] + "–" + d.years[i]], ["Ingresos " + d.years[i], val(d.sales[i])],
      ["Crecimiento anual", pc(m.g[i])], ["Margen bruto", pc(m.gm[i])], ["Margen operacional", pc(m.om[i])], ["Margen neto", pc(m.nm[i])], ["Utilidad neta " + d.years[i], val(d.netIncome[i])], ["CAGR ingresos", pc(m.cagr)]]
      .forEach(([k, v]) => g.appendChild(kcell(k, v)));
    box.appendChild(el("h3", { text: "Datos básicos cargados" })); box.appendChild(g);
    box.appendChild(el("p", { class: "rnote", text: "Fuente: " + d.source + (d.notice ? " · " + d.notice : "") }));
    box.hidden = false;
  }

  let aiAvailable = false, busy = false;

  /* Asegura datos (los carga si faltan), arma el informe y lo muestra */
  async function generate(msg) {
    if (busy) return; busy = true; $("btn-report").disabled = true;
    try {
      setStatus($("report-status"), "Preparando el informe preliminar de " + (TICKER_GLOBAL || "…") + "…");
      const fresh = !state.data || state.dataFor !== TICKER_GLOBAL;
      if (!(await ensureData(false))) return;
      if (fresh) return;   // onFinancialsLoaded vuelve a llamar a generate() con los borradores listos
      setStatus($("report-status"), "Generando informe desde la base de datos…");
      const node = await buildReport(); const v = $("report-view"); v.replaceChildren(node); v.hidden = false; $("report-tools").hidden = false;
      $("btn-report").textContent = "Actualizar informe";
      await Store.put("reports", state.data.ticker + "|" + (field("rp-date") || "sin-fecha"), { form: lastReport && lastReport.form, noticias: news, html: standalone() });
      await refreshChips(); refreshDb();
      setStatus($("report-status"), msg || "Informe preliminar listo y guardado. Edita los campos de arriba y pulsa «Actualizar informe» para enriquecerlo.", "ok");
    } catch (e) { setStatus($("report-status"), "No se pudo generar el informe: " + e.message, "bad"); }
    finally { busy = false; $("btn-report").disabled = false; }
  }

  async function aiRedact() {
    if (!state.data) { setStatus($("report-status"), "Primero genera el informe preliminar (carga los estados).", "bad"); return; }
    const b = $("btn-ai"); b.disabled = true; setStatus($("report-status"), "El agente está redactando con las cifras cargadas…");
    try {
      const res = await fetch(apiBase() + "/draft", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: state.data, signals: signals(state.data).map((x) => x[1]) }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "El servidor respondió " + res.status + ".");
      const L = (a) => (a || []).join("\n");
      $("rp-summary").value = j.summary || $("rp-summary").value; $("rp-bull").value = L(j.bull); $("rp-bear").value = L(j.bear);
      $("rp-sw-s").value = L(j.swot.s); $("rp-sw-w").value = L(j.swot.w); $("rp-sw-o").value = L(j.swot.o); $("rp-sw-t").value = L(j.swot.t);
      busy = false; await generate("Borrador redactado por IA (" + (j.model || "modelo") + ") solo con tus cifras. Revísalo y enriquécelo antes de compartirlo.");
    } catch (e) { setStatus($("report-status"), "No se pudo usar la IA: " + e.message, "bad"); }
    finally { b.disabled = false; }
  }

  /* ---------- ganchos con app.js ---------- */
  window.onFinancialsLoaded = function (d) {
    unlock("step-report");
    if (!field("rp-date")) $("rp-date").value = new Date().toISOString().slice(0, 10);
    const saved = safeGet(CONFIG.STORAGE_KEY); if (!field("rp-author") && saved && saved.name) $("rp-author").value = saved.name;
    state.dataFor = TICKER_GLOBAL;
    renderBasics(d); fillDrafts(d); refreshChips();
    busy = false; generate();
  };
  window.onTickerSent = function () {
    $("btn-report").textContent = "Generar informe preliminar";
    if (!field("rp-date")) $("rp-date").value = new Date().toISOString().slice(0, 10);
    const saved = safeGet(CONFIG.STORAGE_KEY); if (!field("rp-author") && saved && saved.name) $("rp-author").value = saved.name;
    setStatus($("report-status"), "Preparando el informe preliminar de " + TICKER_GLOBAL + "…");
    generate();   // carga los estados, rellena el borrador y muestra el informe sin que tengas que pulsar nada
  };
  window.onTickerChanged = function () {
    state.data = null; state.dataFor = null; $("an-preview").replaceChildren(); refreshChips();
    $("report-view").hidden = true; $("report-tools").hidden = true; $("rp-basics").hidden = true; lastReport = null;
    ["rp-summary", "rp-analysis", "rp-bull", "rp-bear", "rp-sw-s", "rp-sw-w", "rp-sw-o", "rp-sw-t", "rp-call"].forEach((id) => ($(id).value = ""));
  };

  document.addEventListener("DOMContentLoaded", () => {
    if (!$("btn-report")) return;
    document.head.appendChild(el("style", { id: "report-css", text: REPORT_CSS + ".report{border:1px solid #e3e8ef;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(11,42,74,.12)}" }));
    $("btn-news-add").addEventListener("click", addNews);
    $("btn-report").addEventListener("click", () => generate());
    $("btn-an-d").addEventListener("click", async () => { if (await ensureData(false)) { await refreshChips(); refreshDb(); setStatus($("report-status"), "Datos de " + TICKER_GLOBAL + " guardados en la base de datos.", "ok"); } });
    $("btn-an-v").addEventListener("click", () => runAnalysis("vertical"));
    $("btn-an-h").addEventListener("click", () => runAnalysis("horizontal"));
    $("btn-an-r").addEventListener("click", () => runAnalysis("ratios"));
    $("btn-refresh").addEventListener("click", async () => { state.data = null; if (await ensureData(true)) { await refreshChips(); refreshDb(); setStatus($("report-status"), "Datos consultados de nuevo en la fuente y guardados. Vuelve a ejecutar los análisis.", "ok"); } });
    $("btn-db-refresh").addEventListener("click", refreshDb);
    $("btn-db-export").addEventListener("click", async () => save("VCC50000_base_de_datos.json", JSON.stringify(await Store.exportAll(), null, 2), "application/json"));
    if (!field("rp-date")) $("rp-date").value = new Date().toISOString().slice(0, 10);
    refreshDb();
    $("btn-draft").addEventListener("click", () => { if (state.data) { fillDrafts(state.data); generate("Borrador automático regenerado: reemplazó los textos de los campos."); } });
    $("btn-ai").addEventListener("click", aiRedact);
    fetch(apiBase() + "/health").then((x) => x.json()).then((h) => {
      aiAvailable = !!h.ai;
      $("ai-hint").textContent = aiAvailable ? "IA conectada: «Redactar con IA» usa solo las cifras cargadas." : "IA sin configurar: define ANTHROPIC_API_KEY en iniciar.bat para activar «Redactar con IA». Mientras tanto usa el borrador automático o el prompt para Claude.";
    }).catch(() => { $("ai-hint").textContent = "Sin servidor: «Redactar con IA» requiere abrir la página con iniciar.bat."; });
    $("btn-pdf").addEventListener("click", printPdf);
    $("btn-html").addEventListener("click", () => save(fname("html"), standalone(), "text/html;charset=utf-8"));
    $("btn-csv").addEventListener("click", () => save(fname("csv"), csv(), "text/csv;charset=utf-8"));
    $("btn-json").addEventListener("click", () => save(fname("json"), JSON.stringify({ generado: new Date().toISOString(), datos: state.data, formulario: lastReport && lastReport.form, noticias: news }, null, 2), "application/json"));
    $("btn-claude-prompt").addEventListener("click", async () => {
      const p = claudePrompt(), b = $("btn-claude-prompt");
      try { await navigator.clipboard.writeText(p); b.textContent = "¡Copiado! Pégalo en Claude"; } catch (_) { $("rp-call").value = p; b.textContent = "Copiado en el cuadro de notas"; }
      setTimeout(() => (b.textContent = "Copiar prompt para redactar con Claude"), 2500);
    });
  });
})();
