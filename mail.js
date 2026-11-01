"use strict";
/* VCC50000 — recepción de solicitudes por correo (WhatsApp → correo → buzón IMAP).
   Sin dependencias: cliente IMAP mínimo sobre tls/net. Solo LEE (BODY.PEEK): no marca ni borra mensajes. */
const tls = require("tls"), net = require("net");

/* ---- Asunto: "Análisis financiero:TICKER [texto opcional]" ---- */
const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function parseSubject(subject) {
  const s = String(subject || "").replace(/[\u200b-\u200d\ufeff]/g, "").replace(/\uff1a/g, ":").replace(/^\s*(\[[^\]]{1,30}\]\s*)+/, "").replace(/\s+/g, " ").trim();
  const m = /^(?:(?:re|rv|fwd?|fw)\s*:\s*)*(analisis\s+financiero)\s*:\s*([A-Za-z][A-Za-z0-9.\-]{0,5})(?![A-Za-z0-9.\-])\s*(.*)$/i.exec(norm(s) === s.toLowerCase() ? s : s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  if (!m) {   // forma corta: el asunto es solo el ticker en mayúsculas (EC, SLB, BRK.B)
    const b = /^(?:(?:[Rr][EeVv]|[Ff][Ww][Dd]?)\s*:\s*)*([A-Z][A-Z0-9.\-]{0,4})$/.exec(s);
    return b ? { ticker: b[1], empresa: "" } : null;
  }
  const empresa = m[3].replace(/^(de|del)\s+/i, "").trim();
  return { ticker: m[2].toUpperCase(), empresa };
}

/* ---- Cabeceras MIME (RFC 2047) ---- */
function decodeWords(h) {
  return String(h || "").replace(/\r?\n[ \t]+/g, " ").replace(/=\?([\w\-]+)\?([BbQq])\?([^?]*)\?=/g, (_, cs, enc, txt) => {
    try {
      const buf = enc.toUpperCase() === "B" ? Buffer.from(txt, "base64")
        : Buffer.from(txt.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (__, x) => String.fromCharCode(parseInt(x, 16))), "latin1");
      return buf.toString(/^iso-8859-1|latin1|windows-1252$/i.test(cs) ? "latin1" : "utf8");
    } catch (_) { return txt; }
  }).replace(/\?=\s+=\?/g, "");
}
function headerMap(raw) {
  const out = {}; raw.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/).forEach((l) => { const i = l.indexOf(":"); if (i > 0) out[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim(); });
  return out;
}
function findPhone(...texts) {
  const t = texts.join(" ");
  const m = /whatsapp:?\s*(\+?\d[\d\s\-]{7,16}\d)/i.exec(t) || /(\+\d[\d\s\-]{8,16}\d)/.exec(t) || /\b(\d{10,15})\b/.exec(t);
  return m ? m[1].replace(/[\s\-]/g, "") : "";
}
function bodyText(raw) {   // texto plano mínimo: quita base64/quoted-printable evidentes y etiquetas
  let t = String(raw || "");
  if (/^[A-Za-z0-9+\/=\s]{40,}$/.test(t.trim())) { try { t = Buffer.from(t, "base64").toString("utf8"); } catch (_) {} }
  return t.replace(/=\r?\n/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
}

/* ---- Cliente IMAP mínimo ---- */
function imapSession(cfg) {
  return new Promise((resolve, reject) => {
    const sock = cfg.plain ? net.connect(cfg.port, cfg.host) : tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host });
    sock.setEncoding("latin1"); sock.setTimeout(20000, () => { sock.destroy(); reject(new Error("El buzón no respondió a tiempo.")); });
    let buf = "", waiting = null, n = 0, greeted = false;
    const check = () => {
      if (!greeted) { if (/\r\n/.test(buf)) { greeted = true; buf = ""; resolve(api); } return; }
      if (!waiting) return;
      const re = new RegExp("(^|\\r\\n)" + waiting.tag + " (OK|NO|BAD)([^\\r\\n]*)\\r\\n");
      const m = re.exec(buf);
      if (m) { const data = buf.slice(0, m.index + (m[1] ? 2 : 0)); buf = ""; const w = waiting; waiting = null; m[2] === "OK" ? w.res(data) : w.rej(new Error("IMAP " + m[2] + m[3])); }
    };
    sock.on("data", (d) => { buf += d; check(); });
    sock.on("error", (e) => reject(new Error("No se pudo conectar al buzón (" + e.message + ").")));
    const api = { cmd: (c) => new Promise((res, rej) => { const tag = "A" + ++n; waiting = { tag, res, rej }; sock.write(tag + " " + c + "\r\n"); }), close: () => { try { sock.write("A99 LOGOUT\r\n"); sock.end(); } catch (_) {} } };
  });
}
const q = (s) => '"' + String(s).replace(/(["\\])/g, "\\$1") + '"';
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* Extrae de cada respuesta FETCH los bloques BODY[...] por su etiqueta (no por su orden), con sus literales {n} */
function parseFetch(data) {
  const msgs = []; const re = /\* \d+ FETCH \(/g; let m; const starts = [];
  while ((m = re.exec(data))) starts.push(m.index);
  starts.forEach((s, k) => {
    const chunk = data.slice(s, starts[k + 1] || data.length), out = { uid: "", head: "", text: "" };
    const lre = /BODY\[([^\]]*)\](?:<\d+>)?\s*\{(\d+)\}\r\n/g; let lm, last = 0;
    while ((lm = lre.exec(chunk))) {
      const st = lm.index + lm[0].length, len = +lm[2], txt = Buffer.from(chunk.slice(st, st + len), "latin1").toString("utf8");
      if (/^HEADER/i.test(lm[1])) out.head = txt; else if (/^TEXT/i.test(lm[1])) out.text = txt;
      lre.lastIndex = st + len; last = st + len;
    }
    const rest = chunk.slice(0, chunk.search(/BODY\[/) > 0 ? chunk.search(/BODY\[/) : 0) + chunk.slice(last);   // UID fuera de los literales
    const u = /UID (\d+)/.exec(rest); out.uid = u ? u[1] : String(k + 1);
    msgs.push(out);
  });
  return msgs;
}

async function fetchRecent(cfg) {
  const s = await imapSession(cfg);
  try {
    await s.cmd("LOGIN " + q(cfg.user) + " " + q(cfg.pass));
    await s.cmd("SELECT INBOX");
    const since = new Date(Date.now() - (cfg.days || 7) * 864e5);
    const sr = await s.cmd("UID SEARCH SINCE " + since.getUTCDate() + "-" + MON[since.getUTCMonth()] + "-" + since.getUTCFullYear());
    const uids = ((/\* SEARCH([\d ]*)/.exec(sr) || [])[1] || "").trim().split(/\s+/).filter(Boolean).slice(-300);
    if (!uids.length) return [];
    // 1) solo cabeceras de los últimos mensajes (livianas); 2) el fragmento de texto solo de los que parecen solicitudes
    const hr = await s.cmd("UID FETCH " + uids.join(",") + " (UID BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID REPLY-TO)])");
    const msgs = parseFetch(hr).map((m) => {
      const h = headerMap(m.head), from = decodeWords(h.from || ""), subject = decodeWords(h.subject || "");
      return { uid: m.uid, from, subject, date: h.date ? new Date(h.date).toISOString() : null, messageId: h["message-id"] || "", replyTo: h["reply-to"] || "", snippet: "", phone: findPhone(from, h["reply-to"] || "") };
    });
    const hits = msgs.filter((m) => parseSubject(m.subject));
    if (hits.length) {
      const tr = await s.cmd("UID FETCH " + hits.map((m) => m.uid).join(",") + " (UID BODY.PEEK[TEXT]<0.1500>)");
      const texts = {}; parseFetch(tr).forEach((t) => { texts[t.uid] = t.text; });
      hits.forEach((m) => { const t = texts[m.uid] || ""; m.snippet = bodyText(t); m.phone = findPhone(m.from, m.replyTo, t); });
    }
    return msgs;
  } finally { s.close(); }
}

module.exports = { parseSubject, decodeWords, fetchRecent, findPhone };
