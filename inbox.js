"use strict";
/* VCC50000 — bandeja de solicitudes de clientes (WhatsApp → correo). Fase 1: recepción y visualización. */
(function () {
  let timer = null, rows = [];
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
      if (r.whatsapp) who.appendChild(mk("small", "rnote", "WhatsApp: " + r.whatsapp));
      if (r.fragmento) who.appendChild(mk("small", "rnote", "“" + r.fragmento.slice(0, 90) + "”"));
      const tk = mk("td", "tk", r.ticker); if (r.empresa) tk.appendChild(mk("small", "rnote", r.empresa));
      const es = mk("td"); es.appendChild(mk("span", "chip " + (r.estado === "atendida" ? "ok" : r.estado === "en atención" ? "wip" : "new"), r.estado));
      const act = mk("td"); const b = mk("button", "btn small primary", r.estado === "atendida" ? "Atender de nuevo" : "Atender solicitud de cliente");
      b.type = "button"; b.addEventListener("click", () => attend(r)); act.appendChild(b);
      const w = mk("button", "btn small", "Enviar informe por WhatsApp"); w.type = "button"; w.style.marginTop = "6px";
      if (!r.whatsapp) { w.disabled = true; w.title = "La solicitud no trae número de WhatsApp"; }
      w.addEventListener("click", () => sendWa(r)); act.appendChild(document.createElement("br")); act.appendChild(w);
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
    try { const j = await api("/inbox"); rows = j.solicitudes; render();
      $("inbox-hint").textContent = "Buzón: " + j.buzon + (j.configurado ? " · conexión configurada." : " · falta la contraseña de aplicación (GMAIL_APP_PASSWORD en iniciar.bat); puedes probar con «Simular solicitud».");
    } catch (e) { $("inbox-hint").textContent = e.message; }
  }
  async function check() {
    $("btn-inbox-check").disabled = true; st("Revisando el buzón…");
    try { const j = await api("/inbox/check", { method: "POST" }); rows = j.solicitudes; render();
      st(j.nuevas ? j.nuevas + " solicitud(es) nueva(s) capturada(s)." : "Sin solicitudes nuevas (" + j.revisados + " mensajes revisados, " + j.ignoradas + " con otro asunto).", "ok");
    } catch (e) { st(e.message, "bad"); } finally { $("btn-inbox-check").disabled = false; }
  }
  async function test() {
    try { const j = await api("/inbox/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subject: $("inbox-test-subject").value, from: $("inbox-test-from").value }) });
      rows = j.solicitudes; render(); st("Solicitud simulada capturada: " + j.solicitud.ticker + ".", "ok");
    } catch (e) { st(e.message, "bad"); }
  }
  /* Lleva el ticker de la solicitud al flujo normal (pasos 2–4) y deja el informe preliminar listo */
  async function attend(r) {
    if ($("step-ticker").classList.contains("locked")) { st("Primero completa el registro del analista (paso 1) para atender solicitudes.", "bad"); $("step-register").scrollIntoView({ behavior: "smooth" }); return; }
    const sel = $("ticker-select"), known = [...sel.options].some((o) => o.value === r.ticker);
    if (known) { sel.value = r.ticker; sel.dispatchEvent(new Event("change", { bubbles: true })); $("ticker-other").value = ""; }
    else { sel.value = ""; $("ticker-other").value = r.ticker; $("ticker-other").dispatchEvent(new Event("input", { bubbles: true })); }
    $("btn-send-ticker").click();
    try { const j = await api("/inbox/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: r.id, estado: "en atención" }) }); r.estado = j.solicitud.estado; render(); } catch (_) {}
    st("Atendiendo la solicitud de " + r.ticker + ": se prepara el informe preliminar en el paso 4.", "ok");
    $("step-report").scrollIntoView({ behavior: "smooth" });
  }
  /* Publica el informe con un enlace privado y lo envía al WhatsApp del cliente (Twilio) o abre WhatsApp con el mensaje listo (wa.me) */
  async function sendWa(r) {
    const rep = window.getReportForShare && window.getReportForShare();
    if (!rep || rep.ticker !== r.ticker) { st("Primero pulsa «Atender solicitud de cliente» y espera a que el informe de " + r.ticker + " aparezca en el paso 4.", "bad"); return; }
    st("Generando el PDF del informe…");
    try {
      let pdf = ""; try { pdf = await window.makeReportPdf(); } catch (e) { st("No se pudo generar el PDF (" + e.message + "); se enviará el enlace del informe en HTML.", "bad"); }
      const pub = await api("/report/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ html: rep.html, pdf }) });
      const body = rep.text + "\nInforme completo (PDF): " + (pub.pdfUrl || pub.url) + "\nInformación de apoyo analítico; no es asesoría de inversión.";
      const j = await api("/whatsapp/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: r.whatsapp, body, mediaUrl: pub.pdfUrl || "" }) });
      if (j.enviado) { st("Informe enviado por WhatsApp a " + r.whatsapp + ".", "ok"); await mark(r, "atendida"); return; }
      window.open("https://wa.me/" + j.to + "?text=" + encodeURIComponent(body), "_blank", "noopener");
      st("Envío automático sin configurar: se abrió WhatsApp con el mensaje listo para " + r.whatsapp + ". Pulsa enviar allí.", "ok"); await mark(r, "atendida");
    } catch (e) { st(e.message, "bad"); }
  }
  async function mark(r, estado) { try { const j = await api("/inbox/status", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: r.id, estado }) }); r.estado = j.solicitud.estado; render(); } catch (_) {} }
  document.addEventListener("DOMContentLoaded", () => {
    if (!$("btn-inbox-check")) return;
    $("btn-inbox-check").addEventListener("click", check);
    $("btn-inbox-test").addEventListener("click", test);
    $("inbox-auto").addEventListener("change", (e) => { clearInterval(timer); if (e.target.checked) { check(); timer = setInterval(check, 60000); } });
    load();
  });
})();
