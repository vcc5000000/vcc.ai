"use strict";
/* VCC50000 — bandeja de solicitudes de clientes (WhatsApp → correo). Fase 1: recepción y visualización. */
(function () {
  let timer = null, rows = [], waOk = false, mailOk = false, mailVia = "", busy = false;
  const esc = (t) => String(t == null ? "" : t);
  const fdate = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }); };
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const st = (msg, kind) => setStatus($("inbox-status"), msg, kind);

  function render() {
    const tb = $("inbox-body"); tb.replaceChildren();
    $("inbox-table").hidden = !rows.length; $("inbox-empty").hidden = !!rows.length;
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      const who = mk("td"); who.appendChild(mk("div", "", esc(r.remitente) || "—"));
      if (r.responderA) who.appendChild(mk("small", "rnote", "Correo: " + r.responderA)); if (r.whatsapp) who.appendChild(mk("small", "rnote", "WhatsApp: " + r.whatsapp));
      if (r.fragmento) who.appendChild(mk("small", "rnote", "“" + r.fragmento.slice(0, 90) + "”"));
      const tk = mk("td", "tk", r.ticker); if (r.empresa) tk.appendChild(mk("small", "rnote", r.empresa));
      const es = mk("td"); es.appendChild(mk("span", "chip " + (r.estado === "atendida" ? "ok" : r.estado === "en atención" ? "wip" : r.estado === "error" ? "err" : "new"), r.estado));
      const act = mk("td"); if (r.respondida) act.appendChild(mk("small", "rnote", "Respondida a " + r.responderA + " · " + fdate(r.respondida))); const bt = (label, cls, fn, off, why) => { const x = mk("button", "btn small " + cls, label); x.type = "button"; x.style.marginTop = "4px"; if (off) { x.disabled = true; x.title = why; } else x.addEventListener("click", fn); act.appendChild(x); act.appendChild(document.createElement("br")); return x; };
      bt(r.estado === "atendida" ? "Atender de nuevo" : "Atender solicitud de cliente", "primary", () => attend(r));
      bt(r.respondida ? "Responder de nuevo por correo" : "Responder por correo (PDF adjunto)", "primary", () => sendEmail(r), !r.responderA || !mailOk, !r.responderA ? "La solicitud no trae un correo al que responder" : "Falta el correo de salida: BREVO_API_KEY en Render (o GMAIL_APP_PASSWORD en tu computador)");
      bt("Enviar PDF por WhatsApp", "", () => sendManual(r));
      if (waOk) bt("WhatsApp automático (Twilio)", "", () => sendAuto(r));
      if (r.whatsapp) { const c = mk("button", "linkbtn", "Cambiar número"); c.type = "button"; c.addEventListener("click", () => askPhone(r, true)); act.appendChild(c); }
      [mk("td", "", fdate(r.recibida)), who, tk, mk("td", "", esc(r.asunto)), es, act].forEach((c) => tr.appendChild(c));
      tb.appendChild(tr);
    });
  }
  async function api(path, opt) {
    const base = apiBase(); if (!base) throw new Error("Abre la página con iniciar.bat (http://localhost:3001) para leer el buzón.");
    const res = await fetch(base + path, opt), j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || "El servidor respondió " + res.status + ".");
    return j;
  }
  async function load() {
    try { const j = await api("/inbox"); rows = j.solicitudes; waOk = !!j.whatsappConfigurado; mailOk = !!j.puedeResponder; mailVia = j.correoSalida || ""; render(); modeHint();
      $("inbox-hint").textContent = "Buzón: " + j.buzon + (j.configurado ? " · conexión configurada." : " · falta la contraseña de aplicación (GMAIL_APP_PASSWORD en iniciar.bat); puedes probar con «Simular solicitud».");
    } catch (e) { $("inbox-hint").textContent = e.message; }
  }
  async function check() {
    $("btn-inbox-check").disabled = true; st("Revisando el buzón…");
    try { const j = await api("/inbox/check", { method: "POST" }); rows = j.solicitudes; render();
      processQueue(); st(j.nuevas ? j.nuevas + " solicitud(es) nueva(s) capturada(s)." : "Sin solicitudes nuevas (" + j.revisados + " mensajes revisados, " + j.ignoradas + " con otro asunto" + (j.nuevas === 0 && j.detalle && j.detalle.length ? ": " + j.detalle.map((x) => "«" + (x.asunto || "(sin asunto)") + "»").join(", ") : "") + ").", "ok");
    } catch (e) { st(e.message, "bad"); } finally { $("btn-inbox-check").disabled = false; }
  }
  async function test() {
    try { const j = await api("/inbox/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject: $("inbox-test-subject").value, from: $("inbox-test-from").value }) });
      rows = j.solicitudes; render(); st("Solicitud simulada capturada: " + j.solicitud.ticker + ".", "ok"); processQueue();
    } catch (e) { st(e.message, "bad"); }
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ready = (t) => { const rep = window.getReportForShare && window.getReportForShare(); return rep && rep.ticker === t ? rep : null; };
  /* Lleva el ticker de la solicitud al flujo normal (pasos 2–4) y deja el informe preliminar listo */
  async function attend(r, quiet) {
    if ($("step-ticker").classList.contains("locked")) { st("Primero completa el registro del analista (paso 1) para atender solicitudes.", "bad"); $("step-register").scrollIntoView({ behavior: "smooth" }); return false; }
    const sel = $("ticker-select"), known = [...sel.options].some((o) => o.value === r.ticker);
    if (known) { sel.value = r.ticker; sel.dispatchEvent(new Event("change", { bubbles: true })); $("ticker-other").value = ""; }
    else { sel.value = ""; $("ticker-other").value = r.ticker; $("ticker-other").dispatchEvent(new Event("input", { bubbles: true })); }
    $("btn-send-ticker").click();
    await mark(r, "en atención");
    st("Atendiendo la solicitud de " + r.ticker + ": se prepara el informe preliminar en el paso 4.", "ok");
    if (!quiet) $("step-report").scrollIntoView({ behavior: "smooth" });
    return true;
  }
  /* Deja listo el informe del ticker (lo atiende si hace falta) y espera hasta 90 s */
  async function ensureReport(r) {
    if (ready(r.ticker)) return ready(r.ticker);
    if (!(await attend(r, true))) return null;
    for (let i = 0; i < 90; i++) { await sleep(1000); const rep = ready(r.ticker); if (rep) return rep; const t = $("report-status").textContent; if (/No se pudo|No se pudieron/.test(t)) throw new Error(t); }
    throw new Error("El informe de " + r.ticker + " tardó demasiado en generarse.");
  }
  /* PDF + enlace privado + texto del mensaje */
  async function prepare(r) {
    st("Preparando el informe de " + r.ticker + "…");
    const rep = await ensureReport(r); if (!rep) return null;
    st("Generando el PDF del informe…");
    let pdf = ""; try { pdf = await window.makeReportPdf(); } catch (e) { st("No se pudo generar el PDF (" + e.message + "); se usará el enlace del informe en HTML.", "bad"); }
    const pub = await api("/report/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ html: rep.html, pdf }) });
    return { pub, body: rep.text + "\nInforme completo (PDF): " + (pub.pdfUrl || pub.url) + "\nInformación de apoyo analítico; no es asesoría de inversión." };
  }
  /* Respuesta por correo: el servidor responde al remitente con el PDF adjunto (SMTP de Gmail) */
  async function sendEmail(r) {
    try {
      const p = await prepare(r); if (!p) return false;
      const rep = ready(r.ticker);
      const j = await api("/inbox/reply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: r.id, token: p.pub.token, resumen: rep ? rep.text : "" }) });
      Object.assign(r, j.solicitud); render(); st("Informe respondido por correo a " + j.a + (j.pdfAdjunto ? " con el PDF adjunto" : " con el enlace al informe (no se pudo adjuntar el PDF)") + (j.via === "brevo" ? " · enviado por Brevo." : "."), j.pdfAdjunto ? "ok" : "bad"); return true;
    } catch (e) { st("No se pudo responder a " + (r.responderA || "la solicitud") + ": " + e.message, "bad"); await mark(r, "error"); return false; }
  }
  /* Envío automático: el servidor manda el mensaje con el PDF adjunto por la API de WhatsApp (Twilio) */
  /* Pide (o cambia) el número de WhatsApp del cliente y lo guarda en la solicitud. Devuelve el número o "" si se cancela. */
  async function askPhone(r, change) {
    if (r.whatsapp && !change) return r.whatsapp;
    const v = window.prompt("Número de WhatsApp del cliente, con código de país (por ejemplo 573001234567 para Colombia o 13055551234 para EE. UU.):", r.whatsapp || "");
    if (v === null) return "";
    const w = v.replace(/\D/g, "");
    if (w.length < 8 || w.length > 15) { st("Número no válido: escribe el código de país y el número, sin espacios ni signos.", "bad"); return ""; }
    try { const j = await api("/inbox/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: r.id, whatsapp: w }) }); Object.assign(r, j.solicitud); }
    catch (e) { r.whatsapp = w; }
    render(); return r.whatsapp;
  }
  async function sendAuto(r, quiet) {
    if (!(await askPhone(r))) return false;
    try {
      const p = await prepare(r); if (!p) return false;
      const j = await api("/whatsapp/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: r.whatsapp, body: p.body, mediaUrl: p.pub.pdfUrl || "" }) });
      if (!j.enviado) throw new Error(j.aviso || "El envío automático no está configurado.");
      st("Informe enviado automáticamente por WhatsApp a " + r.whatsapp + ".", "ok"); await mark(r, "atendida"); return true;
    } catch (e) { st("No se pudo enviar a " + r.whatsapp + ": " + e.message, "bad"); await mark(r, "error"); return false; }
  }
  /* Envío manual: abre WhatsApp con el mensaje y el enlace al PDF; la persona pulsa enviar */
  async function sendManual(r) {
    if (!(await askPhone(r))) return;
    const w = window.open("", "_blank");   // se abre ya, en el clic, para que el navegador no la bloquee
    try {
      const p = await prepare(r); if (!p) { if (w) w.close(); return; }
      const to = String(r.whatsapp).replace(/\D/g, ""), u = "https://wa.me/" + to + "?text=" + encodeURIComponent(p.body);
      if (w) { w.location.href = u; st("Se abrió WhatsApp con el mensaje y el enlace al PDF para " + r.whatsapp + ". Pulsa enviar allí.", "ok"); }
      else {   // el navegador bloqueó la ventana (pasa tras escribir el número): se deja un botón para abrirla con un clic
        const a = mk("a", "btn small primary", "Abrir WhatsApp con el mensaje listo"); a.href = u; a.target = "_blank"; a.rel = "noopener";
        $("inbox-status").className = "status ok"; $("inbox-status").replaceChildren(a);
      }
      await mark(r, "atendida");
    } catch (e) { if (w) w.close(); st(e.message, "bad"); }
  }
  /* Correo de prueba: valida Brevo (o SMTP) enviando un mensaje al buzón o a la dirección escrita */
  async function mailTest() {
    const b = $("btn-mail-test"); b.disabled = true; st("Enviando correo de prueba…");
    try { const j = await api("/mail/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: $("mail-test-to").value }) });
      st("Correo de prueba enviado a " + j.a + (j.via === "brevo" ? " por Brevo" : " por SMTP") + ". Revisa la bandeja de entrada (y spam).", "ok");
    } catch (e) { st(e.message, "bad"); } finally { b.disabled = !mailOk; }
  }
  async function mark(r, estado) { try { const j = await api("/inbox/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: r.id, estado }) }); r.estado = j.solicitud.estado; render(); } catch (_) {} }

  /* Modo automático: atiende y envía, una por una, las solicitudes nuevas con número de WhatsApp */
  async function processQueue() {
    if (busy || !$("inbox-autosend").checked) return; busy = true;
    try { for (const r of rows.filter((x) => x.estado === "recibida" && x.responderA).reverse()) { if (!$("inbox-autosend").checked) break; await sendEmail(r); } }
    finally { busy = false; }
  }
  function modeHint() {
    const c = $("inbox-autosend"), box = $("lbl-autosend");
    c.disabled = !mailOk; box.title = mailOk ? "" : "Requiere BREVO_API_KEY en Render (o GMAIL_APP_PASSWORD en tu computador)";
    $("inbox-mode").textContent = (mailOk ? "Respuesta por correo disponible" + (mailVia === "brevo" ? " (Brevo)" : mailVia === "smtp" ? " (SMTP de Gmail)" : "") + ": «Responder por correo» envía el informe en PDF al remitente. Con la casilla activada, la página (abierta y con sesión de analista) atiende y responde cada solicitud nueva."
      : "Para responder por correo falta el correo de salida: BREVO_API_KEY en Render (o GMAIL_APP_PASSWORD en tu computador).") +
      " «Enviar PDF por WhatsApp» abre WhatsApp con el mensaje y el enlace al PDF; si la solicitud no trae el número, lo pide.";
    $("btn-mail-test").disabled = !mailOk;
  }
  document.addEventListener("DOMContentLoaded", () => {
    if (!$("btn-inbox-check")) return;
    $("btn-inbox-check").addEventListener("click", check);
    $("btn-inbox-test").addEventListener("click", test);
    $("btn-mail-test").addEventListener("click", mailTest);
    $("inbox-auto").addEventListener("change", (e) => { clearInterval(timer); if (e.target.checked) { check(); timer = setInterval(check, 60000); } });
    const as = $("inbox-autosend");
    as.addEventListener("change", () => {
      if (as.checked) { if ($("step-ticker").classList.contains("locked")) { as.checked = false; st("Primero completa el registro del analista (paso 1).", "bad"); return; } if (!$("inbox-auto").checked) { $("inbox-auto").checked = true; $("inbox-auto").dispatchEvent(new Event("change")); } processQueue(); st("Envío automático activado.", "ok"); }
      else st("Envío automático desactivado: las solicitudes quedan en la lista para enviarlas a mano.", "ok");
    });
    load();
  });
})();
