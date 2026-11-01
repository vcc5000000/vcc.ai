"use strict";
/* ============================================================
   VCC50000 — persistencia local.
   Tablas: financials (estados cargados), analysis (vertical, horizontal, ratios), reports (informes).
   Se guarda en el navegador (IndexedDB) y, si corre iniciar.bat, también en la carpeta ./db del servidor.
   Lectura: primero el navegador, luego el servidor. Nada sale a terceros.
   ============================================================ */
const Store = (function () {
  const TABLES = ["financials", "analysis", "reports"];
  let dbp = null; const mem = new Map();
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      try {
        const rq = indexedDB.open("vcc50000", 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore("kv", { keyPath: "id" });
        rq.onsuccess = () => resolve(rq.result);
        rq.onerror = () => resolve(null);
      } catch (_) { resolve(null); }
    });
    return dbp;
  }
  function tx(db, mode, fn) {
    return new Promise((resolve) => {
      try { const t = db.transaction("kv", mode), st = t.objectStore("kv"); const r = fn(st); t.oncomplete = () => resolve(r && "result" in r ? r.result : true); t.onerror = () => resolve(null); t.onabort = () => resolve(null); }
      catch (_) { resolve(null); }
    });
  }
  const id = (table, key) => table + "/" + key;
  const server = (suffix, opt) => {
    const base = typeof apiBase === "function" ? apiBase() : "";
    if (!base) return Promise.resolve(null);
    return fetch(base + "/db" + suffix, opt).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  };
  const enc = (s) => encodeURIComponent(s);

  async function put(table, key, value) {
    const rec = { id: id(table, key), table, key, updated: new Date().toISOString(), value };
    const db = await open();
    if (db) await tx(db, "readwrite", (st) => st.put(rec)); else mem.set(rec.id, rec);
    server("/" + table + "/" + enc(key), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(rec) });
    return rec;
  }
  async function get(table, key) {
    const db = await open(); let rec = null;
    if (db) rec = await tx(db, "readonly", (st) => st.get(id(table, key))); else rec = mem.get(id(table, key)) || null;
    if (rec && rec.value) return rec;
    const sv = await server("/" + table + "/" + enc(key));
    if (sv && sv.value) { if (db) await tx(db, "readwrite", (st) => st.put(sv)); else mem.set(sv.id, sv); return sv; }
    return null;
  }
  async function list() {
    const db = await open(); let all = [];
    if (db) all = (await tx(db, "readonly", (st) => st.getAll())) || []; else all = [...mem.values()];
    return all.map((r) => ({ table: r.table, key: r.key, updated: r.updated, bytes: JSON.stringify(r.value).length })).sort((a, b) => (a.table + a.key).localeCompare(b.table + b.key));
  }
  async function del(table, key) {
    const db = await open();
    if (db) await tx(db, "readwrite", (st) => st.delete(id(table, key))); else mem.delete(id(table, key));
    server("/" + table + "/" + enc(key), { method: "DELETE" });
  }
  async function exportAll() {
    const db = await open(); const all = db ? (await tx(db, "readonly", (st) => st.getAll())) || [] : [...mem.values()];
    return { exportado: new Date().toISOString(), registros: all };
  }
  return { put, get, list, del, exportAll, TABLES };
})();
