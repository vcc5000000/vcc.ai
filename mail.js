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


/* ---- Dirección de respuesta ---- */
const BAD_SENDER = /(no-?reply|do-?not-?reply|mailer-daemon|postmaster|bounce|notifications?@|newsletter)/i;
function parseAddress(...fields) {
  for (const f of fields) {
    const t = String(f || ""); const m = /<([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>/.exec(t) || /([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/.exec(t);
    if (m && !BAD_SENDER.test(m[1])) return m[1].toLowerCase();
  }
  return "";
}

/* ---- SMTP mínimo (Gmail: smtp.gmail.com:465, mismo usuario y contraseña de aplicación) ---- */
function smtpSend(cfg, from, to, raw) {
  return new Promise((resolve, reject) => {
    const sock = cfg.plain ? net.connect(cfg.port, cfg.host) : tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host });
    sock.setEncoding("utf8"); sock.setTimeout(30000, () => { sock.destroy(); reject(new Error("El servidor de correo saliente no respondió a tiempo.")); });
    let buf = "", waiter = null;
    const feed = () => { const lines = buf.split("\r\n"); // respuesta completa: última línea con "NNN " (sin guion)
      for (let i = 0; i < lines.length - 1; i++) if (/^\d{3} /.test(lines[i]) && waiter) { const code = +lines[i].slice(0, 3), txt = lines.slice(0, i + 1).join("\n"); buf = lines.slice(i + 1).join("\r\n"); const w = waiter; waiter = null; return w(code, txt); } };
    sock.on("data", (d) => { buf += d; feed(); });
    sock.on("error", (e) => reject(new Error("No se pudo conectar al correo saliente (" + e.message + ").")));
    const get = () => new Promise((res) => { waiter = (c, t) => res({ c, t }); feed(); });
    const step = async (cmd, ok) => { if (cmd !== null) sock.write(cmd + "\r\n"); const r = await get(); if (!ok.includes(r.c)) throw new Error("SMTP " + r.c + ": " + r.t.split("\n").pop().slice(4)); return r; };
    (async () => {
      await step(null, [220]); await step("EHLO vcc50000.local", [250]);
      await step("AUTH PLAIN " + Buffer.from("\0" + cfg.user + "\0" + cfg.pass).toString("base64"), [235]);
      await step("MAIL FROM:<" + from + ">", [250]); await step("RCPT TO:<" + to + ">", [250, 251]); await step("DATA", [354]);
      sock.write(raw.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..") + "\r\n.\r\n"); await step(null, [250]);
      sock.write("QUIT\r\n"); sock.end(); resolve(true);
    })().catch((e) => { try { sock.destroy(); } catch (_) {} reject(e); });
  });
}
const b64lines = (buf) => buf.toString("base64").replace(/(.{76})/g, "$1\r\n");
const encWord = (t) => (/^[\x20-\x7e]*$/.test(t) ? t : "=?UTF-8?B?" + Buffer.from(t, "utf8").toString("base64") + "?=");
/* Arma un correo MIME con el cuerpo en texto y el PDF adjunto; no se puede confundir con una solicitud (asunto distinto y cabecera propia) */
function buildReply(o) {
  const bd = "vcc50000-" + Math.random().toString(16).slice(2), host = o.from.split("@")[1] || "vcc50000.local";
  const h = ["From: " + encWord("VCC50000 Insight") + " <" + o.from + ">", "To: <" + o.to + ">", "Subject: " + encWord(o.subject), "Date: " + new Date().toUTCString(),
    "Message-ID: <" + Date.now() + "." + Math.random().toString(16).slice(2) + "@" + host + ">", "X-VCC50000-Reply: 1", "Auto-Submitted: auto-replied", "MIME-Version: 1.0"];
  if (o.inReplyTo) { h.push("In-Reply-To: " + o.inReplyTo, "References: " + o.inReplyTo); }
  h.push('Content-Type: multipart/mixed; boundary="' + bd + '"', "", "--" + bd, 'Content-Type: text/plain; charset="UTF-8"', "Content-Transfer-Encoding: base64", "", b64lines(Buffer.from(o.text, "utf8")));
  if (o.pdf) h.push("--" + bd, 'Content-Type: application/pdf; name="' + o.filename + '"', 'Content-Disposition: attachment; filename="' + o.filename + '"', "Content-Transfer-Encoding: base64", "", b64lines(o.pdf));
  h.push("--" + bd + "--", "");
  return h.join("\r\n");
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
    const hr = await s.cmd("UID FETCH " + uids.join(",") + " (UID BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE MESSAGE-ID REPLY-TO AUTO-SUBMITTED X-VCC50000-REPLY)])");
    const msgs = parseFetch(hr).map((m) => {
      const h = headerMap(m.head), from = decodeWords(h.from || ""), subject = decodeWords(h.subject || "");
      return { uid: m.uid, from, subject, date: h.date ? new Date(h.date).toISOString() : null, messageId: h["message-id"] || "", replyTo: h["reply-to"] || "", auto: !!(h["x-vcc50000-reply"] || /auto-/i.test(h["auto-submitted"] || "")), snippet: "", phone: findPhone(from, h["reply-to"] || "") };
    });
    const hits = msgs.filter((m) => !m.auto && parseSubject(m.subject));
    if (hits.length) {
      const tr = await s.cmd("UID FETCH " + hits.map((m) => m.uid).join(",") + " (UID BODY.PEEK[TEXT]<0.1500>)");
      const texts = {}; parseFetch(tr).forEach((t) => { texts[t.uid] = t.text; });
      hits.forEach((m) => { const t = texts[m.uid] || ""; m.snippet = bodyText(t); m.phone = findPhone(m.from, m.replyTo, t); });
    }
    return msgs;
  } finally { s.close(); }
}

module.exports = { parseSubject, decodeWords, fetchRecent, findPhone, parseAddress, smtpSend, buildReply };
