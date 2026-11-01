"use strict";
/* VCC50000 — genera un PDF real (texto, tablas e imágenes de las gráficas) a partir del informe que se ve en pantalla.
   Usa pdf-lib (vendor/pdf-lib.min.js). Devuelve el PDF en base64. */
window.makeReportPdf = async function () {
  const root = document.querySelector("#report-view .report");
  if (!root) throw new Error("No hay informe en pantalla.");
  if (!window.PDFLib) throw new Error("Falta la librería de PDF (vendor/pdf-lib.min.js).");
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  const F = await doc.embedFont(StandardFonts.Helvetica), FB = await doc.embedFont(StandardFonts.HelveticaOblique ? StandardFonts.HelveticaBold : StandardFonts.HelveticaBold), FI = await doc.embedFont(StandardFonts.HelveticaOblique);
  const NAVY = rgb(0.043, 0.165, 0.29), GRAY = rgb(0.32, 0.44, 0.55), LINE = rgb(0.89, 0.91, 0.94), BG = rgb(0.957, 0.965, 0.976), TEAL = rgb(0.059, 0.71, 0.729), WHITE = rgb(1, 1, 1);
  const PW = 595.28, PH = 841.89, M = 36, CW = PW - 2 * M;
  const okChars = new Set(F.getCharacterSet());
  const clean = (s) => String(s == null ? "" : s).replace(/[▲]/g, "+").replace(/[▼]/g, "-").replace(/●/g, "•").replace(/→/g, "->").replace(/[−–]/g, "-").replace(/[   ]/g, " ")
    .replace(/\s+/g, " ").split("").map((c) => (okChars.has(c.codePointAt(0)) ? c : "?")).join("").trim();
  let page, y;
  const newPage = () => { page = doc.addPage([PW, PH]); y = PH - M; };
  const need = (h) => { if (y - h < M + 14) newPage(); };
  newPage();
  const wrap = (text, font, size, width) => {
    const out = []; let line = "";
    clean(text).split(" ").forEach((w) => { const t = line ? line + " " + w : w; if (font.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = w; } else line = t; });
    if (line) out.push(line); return out.length ? out : [""];
  };
  function para(text, o) {
    o = o || {}; const size = o.size || 9.5, font = o.font || F, lh = size * 1.32, x = o.x || M, w = o.w || CW;
    wrap(text, font, size, w).forEach((ln) => { need(lh); page.drawText(ln, { x, y: y - size, size, font, color: o.color || NAVY }); y -= lh; });
    y -= o.after == null ? 4 : o.after;
  }
  function bar(text, size, h, left) {
    need(h + 56); page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: BG });
    if (left) page.drawRectangle({ x: M, y: y - h, width: 4, height: h, color: NAVY });
    page.drawText(clean(text), { x: M + 10, y: y - h + (h - size) / 2 + 1.5, size, font: FB, color: NAVY, maxWidth: CW - 14 }); y -= h + 6;
  }
  function kgrid(el) {
    const cells = [...el.querySelectorAll(".kcell")], cols = 4, gap = 6, cw = (CW - gap * (cols - 1)) / cols, h = 34;
    for (let i = 0; i < cells.length; i += cols) {
      need(h + gap);
      cells.slice(i, i + cols).forEach((c, k) => {
        const x = M + k * (cw + gap), manual = c.classList.contains("m");
        page.drawRectangle({ x, y: y - h, width: cw, height: h, borderColor: LINE, borderWidth: 0.8, color: WHITE });
        page.drawRectangle({ x, y: y - h, width: 3, height: h, color: manual ? rgb(1, 0.71, 0.15) : TEAL });
        page.drawText(clean(c.children[0].textContent).slice(0, 26), { x: x + 8, y: y - 12, size: 6.8, font: F, color: GRAY });
        const v = clean(c.children[1].textContent); let sz = 11; while (FB.widthOfTextAtSize(v, sz) > cw - 14 && sz > 6.5) sz -= 0.5;
        page.drawText(v, { x: x + 8, y: y - 26, size: sz, font: FB, color: NAVY });
      });
      y -= h + gap;
    }
    y -= 2;
  }
  function table(el) {
    const rows = [...el.querySelectorAll("tr")]; if (!rows.length) return; need(Math.min(rows.length, 4) * 14 + 4);
    const ncol = rows[0].children.length, first = Math.min(CW * 0.34, 190), other = (CW - first) / Math.max(1, ncol - 1), fs = 7.6, lh = 10;
    rows.forEach((tr) => {
      const cells = [...tr.children], isHead = !!tr.closest("thead"), isGrp = tr.classList.contains("grp"), isSub = tr.classList.contains("sub");
      const lines0 = isGrp ? [clean(cells[0].textContent)] : wrap(cells[0].textContent, isHead ? FB : F, fs, first - 8);
      const h = Math.max(1, lines0.length) * lh + 4; need(h);
      if (isHead) page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: NAVY });
      else if (isGrp) page.drawRectangle({ x: M, y: y - h, width: CW, height: h, color: rgb(0.93, 0.965, 0.97) });
      else page.drawLine({ start: { x: M, y: y - h }, end: { x: M + CW, y: y - h }, thickness: 0.4, color: LINE });
      const font = isHead || isGrp ? FB : isSub ? FI : F, col = isHead ? WHITE : isSub ? GRAY : NAVY;
      lines0.forEach((ln, k) => page.drawText(isGrp ? ln.toUpperCase() : ln, { x: M + 4, y: y - lh * (k + 1) + 2.5, size: fs, font, color: col }));
      if (!isGrp) cells.slice(1).forEach((c, k) => { const t = clean(c.textContent), w = font.widthOfTextAtSize(t, fs); page.drawText(t, { x: M + first + other * (k + 1) - w - 4, y: y - lh + 2.5, size: fs, font, color: col }); });
      y -= h;
    });
    y -= 8;
  }
  async function image(img, x, w) {
    try {
      const src = img.getAttribute("src") || ""; if (!/^data:image\/(png|jpeg);base64,/.test(src)) return 0;
      const im = /png;/.test(src.slice(0, 20)) ? await doc.embedPng(src) : await doc.embedJpg(src);
      const h = im.height * w / im.width; return { im, h, x, w };
    } catch (_) { return 0; }
  }
  async function walk(node) {
    for (const el of [...node.children]) {
      const cl = el.classList, tag = el.tagName;
      if (cl.contains("r-head")) { need(40); page.drawRectangle({ x: 0, y: y - 30 + 0, width: PW, height: 34, color: NAVY }); page.drawText("VCC50000 Insight", { x: M, y: y - 18, size: 14, font: FB, color: WHITE });
        const sm = "INFORME DE ANALISIS FINANCIERO"; page.drawText(sm, { x: PW - M - F.widthOfTextAtSize(sm, 7.5), y: y - 17, size: 7.5, font: F, color: WHITE }); page.drawRectangle({ x: 0, y: y - 34, width: PW / 3, height: 3, color: TEAL }); page.drawRectangle({ x: PW / 3, y: y - 34, width: PW / 3, height: 3, color: rgb(1, 0.71, 0.15) }); page.drawRectangle({ x: 2 * PW / 3, y: y - 34, width: PW / 3, height: 3, color: rgb(1, 0.42, 0.36) }); y -= 50; }
      else if (cl.contains("r-title")) { para(el.querySelector("h1").textContent, { size: 19, font: FB, after: 4 }); para(el.querySelector("p").textContent, { size: 8.5, color: GRAY, after: 8 }); }
      else if (tag === "H2") { need(120); bar(el.textContent, 11.5, 20, true); }
      else if (tag === "H3") { bar(el.textContent, 9, 15, false); }
      else if (tag === "P") para(el.textContent, { size: cl.contains("rnote") || cl.contains("disc") ? 7.8 : 9.5, color: cl.contains("rnote") ? GRAY : NAVY });
      else if (cl.contains("kgrid")) kgrid(el);
      else if (tag === "TABLE") table(el);
      else if (tag === "UL") [...el.children].forEach((li) => para((cl.contains("sig") ? "" : "•  ") + li.textContent, { x: M + 8, w: CW - 8, after: 2 }));
      else if (tag === "IMG") { const r = await image(el, M, CW); if (r) { need(r.h + 6); page.drawImage(r.im, { x: M, y: y - r.h, width: r.w, height: r.h }); y -= r.h + 8; } }
      else if (cl.contains("two") && el.querySelector("img") && !el.querySelector(".box")) {
        const imgs = [...el.querySelectorAll("img")], w = (CW - 8) / imgs.length, rs = []; for (const im of imgs) rs.push(await image(im, 0, w));
        const h = Math.max(...rs.map((r) => (r ? r.h : 0))); need(h + 6); rs.forEach((r, k) => { if (r) page.drawImage(r.im, { x: M + k * (w + 8), y: y - r.h, width: w, height: r.h }); }); y -= h + 8; }
      else if (cl.contains("box")) { const t = el.querySelector("h3"); if (t) para(t.textContent, { size: 9.5, font: FB, after: 2 }); [...el.querySelectorAll("li")].forEach((li) => para("•  " + li.textContent, { x: M + 8, w: CW - 8, after: 2 })); y -= 4; }
      else if (cl.contains("news")) { const a = el.querySelector("a,strong"); if (a) para(a.textContent + (a.href ? "  (" + a.href + ")" : ""), { size: 9, font: FB, after: 1 }); [...el.querySelectorAll(".meta,p")].forEach((p) => para(p.textContent, { size: 8.3, color: GRAY, after: 1 })); y -= 4; }
      else if (el.children.length) await walk(el);
      else if (el.textContent.trim()) para(el.textContent, { size: 9 });
    }
  }
  await walk(root);
  const pages = doc.getPages();
  pages.forEach((p, i) => { const t = "VCC50000 Insight  |  Informacion de apoyo analitico; no es asesoria de inversion  |  Pagina " + (i + 1) + " de " + pages.length; p.drawText(t, { x: M, y: 20, size: 7, font: F, color: GRAY }); });
  doc.setTitle("VCC50000 Insight"); doc.setAuthor("VCC50000");
  return await doc.saveAsBase64();
};
