// Water API 1.0: the residential water supply storage console.
// Serves the React app (WEB_DIR) and a JSON API built from three sources:
//   water.db (read-only, written by Node-RED), Home Assistant (live states, switching, settings),
//   and the controller state Node-RED writes to /share/water-state.json every 5 seconds.
const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = process.env.WATER_DB || "/addon_configs/a0d7b954_nodered/node-red/water.db";
// The web app: a newer copy in /share wins over the one baked into the image.
const WEB_DIR = process.env.WATER_WEB || ["/share/water-web", path.join(__dirname, "public")].find((d) => fs.existsSync(path.join(d, "index.html"))) || path.join(__dirname, "public");
const STATE_FILE = process.env.WATER_STATE || "/share/water-state.json";
const HA = "http://supervisor/core/api";
const IST = 330 * 60000;
const H = 3600000;

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "32kb" }));

// ---------- config ----------
let USERNAME = process.env.WATER_USERNAME || "";
let PASSWORD = process.env.WATER_PASSWORD || "";
try {
  const opts = JSON.parse(fs.readFileSync("/data/options.json", "utf8"));
  USERNAME = opts.username || USERNAME;
  PASSWORD = opts.password || PASSWORD;
} catch {}

// ---------- login ----------
const same = (a, b) => {
  const x = crypto.createHash("sha256").update(a).digest();
  const y = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(x, y);
};
app.use((req, res, next) => {
  if (!PASSWORD) return next();
  const [type, value] = (req.headers.authorization || "").split(" ");
  if (type === "Basic" && value) {
    const [user, ...rest] = Buffer.from(value, "base64").toString().split(":");
    if (same(rest.join(":"), PASSWORD) && (!USERNAME || same(user, USERNAME))) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Water storage"').status(401).send("Login required");
});

// ---------- helpers ----------
const ENT = {
  tank: "sensor.esp32_tank_water_level",
  flow: "sensor.esp32_motor_water_flow_rate",
  tds: "sensor.esp32_motor_tds_sensor_ppm",
  pump: "switch.water_motor_pump",
  valve: "switch.esp32_motor_drain_valve_switch",
  watts: "sensor.water_motor_pump_current_consumption",
  volts: "sensor.water_motor_pump_voltage",
  sub: "switch.random_smart_socket",
  subWatts: "sensor.random_smart_socket_current_consumption",
  subAutoOff: "number.random_smart_socket_turn_off_in",
  manual: "input_boolean.water_manual_control",
  settings: "input_text.water_backup_settings",
};
const CONTROL = {
  pump: ENT.pump,
  valve: ENT.valve,
  sub: ENT.sub,
  manual: ENT.manual,
};

const haHeaders = () => ({ Authorization: `Bearer ${process.env.SUPERVISOR_TOKEN}`, "Content-Type": "application/json" });
async function haState(id) {
  try {
    const r = await fetch(`${HA}/states/${id}`, { headers: haHeaders(), signal: AbortSignal.timeout(4000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
async function haStates(map) {
  const out = {};
  await Promise.all(Object.entries(map).map(async ([k, id]) => (out[k] = await haState(id))));
  return out;
}
async function haCall(domain, service, entity_id, data = {}) {
  const r = await fetch(`${HA}/services/${domain}/${service}`, { method: "POST", headers: haHeaders(), body: JSON.stringify({ entity_id, ...data }), signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`Home Assistant said ${r.status}`);
}
/** Controller state that Node-RED writes every 5 seconds. Null when missing or older than 2 minutes. */
async function controllerState() {
  try {
    const j = JSON.parse(await fs.promises.readFile(STATE_FILE, "utf8"));
    return Date.now() - (j.at || 0) < 120000 ? j : null;
  } catch { return null; }
}
const num = (s) => (s && s.state !== "unavailable" && s.state !== "unknown" && s.state !== "" && Number.isFinite(+s.state) ? +s.state : null);
const sw = (s) => (s && (s.state === "on" || s.state === "off") ? s.state : null);
const seen = (s) => (s ? Date.parse(s.last_reported || s.last_updated) : null);
const midnight = () => { const d = new Date(Date.now() + IST); d.setUTCHours(0, 0, 0, 0); return d.getTime() - IST; };
const istDate = (ms) => new Date(ms + IST).toISOString().slice(0, 10);
const q = (sql, ...args) => { try { return db.prepare(sql).all(...args); } catch (e) { console.error(sql, e.message); return []; } };
const q1 = (sql, ...args) => q(sql, ...args)[0] || null;

/** Average readings into at most `max` buckets so charts stay light. */
function bucket(rows, max) {
  if (rows.length <= max) return rows;
  const t0 = rows[0].ts, span = rows[rows.length - 1].ts - t0 || 1, size = span / max;
  const out = [];
  let cur = null;
  for (const r of rows) {
    const b = Math.min(max - 1, Math.floor((r.ts - t0) / size));
    if (!cur || cur.b !== b) { if (cur) out.push(fin(cur)); cur = { b, ts: r.ts, n: 0, tank: [0, 0], flow: [0, 0], tds: [0, 0], pump_w: [0, 0] }; }
    for (const k of ["tank", "flow", "tds", "pump_w"]) if (r[k] != null) { cur[k][0] += r[k]; cur[k][1]++; }
  }
  if (cur) out.push(fin(cur));
  return out;
  function fin(c) {
    const avg = (k) => (c[k][1] ? Math.round((c[k][0] / c[k][1]) * 10) / 10 : null);
    return { ts: c.ts, tank: avg("tank"), flow: avg("flow"), tds: avg("tds"), pump_w: avg("pump_w") };
  }
}

const DEFAULT_CFG = { startBelow: 20, leaveAtSupply: 25, maxTarget: 50, minHoursAway: 6, maxRunMin: 60 };

// ---------- v1 API (used by the web app) ----------
app.get("/api/v1/now", async (req, res) => {
  const [s, nr] = await Promise.all([haStates(ENT), controllerState()]);
  const lean = nr?.lean || {};
  const ev = lean.ev;
  const manualOn = sw(s.manual) === "on";
  const since = lean.manualSince || (manualOn && s.manual ? Date.parse(s.manual.last_changed) : null);
  const week = nr?.week || {};
  const bs = nr?.backup || {};
  res.json({
    ts: Date.now(),
    tank: num(s.tank) ?? (Number.isFinite(lean.tank) ? lean.tank : null),
    flow: num(s.flow),
    tds: num(s.tds),
    volts: num(s.volts),
    main: { state: sw(s.pump), watts: num(s.watts) },
    valve: sw(s.valve),
    sub: { state: sw(s.sub), watts: num(s.subWatts), autoOffMin: num(s.subAutoOff) },
    manual: { on: manualOn, since: manualOn ? since : null, until: manualOn && since ? since + 90 * 60000 : null },
    ctrl: {
      phase: lean.phase || null,
      sub: lean.sub || null,
      event: ev ? {
        id: ev.id, kind: ev.kind, openedAt: ev.openedAt, mode: ev.mode || null, tankStart: ev.tankStart ?? null, tankMax: ev.tankMax ?? null,
        runs: ev.runs || 0, runMin: Math.round((ev.runMs || 0) / 60000), tdsMin: ev.tdsMin ?? null, tdsMax: ev.tdsMax ?? null, peakFlow: ev.peakFlow ?? null,
      } : null,
      lastStop: lean.stopCause ? { at: lean.stopCause.at, reason: lean.stopCause.reason } : null,
      online: Boolean(nr && Date.now() - (lean.lastTick || 0) < 120000),
    },
    week: { window: week.window || null, lastSupply: week.lastSupply || null, next: week.next ? { date: week.next.date, label: week.next.label, p: week.next.p } : null, days: week.days || [] },
    backup: { running: bs.running || null, rate: bs.rate || 0.67, hoursLeft: bs.hoursLeft ?? null, nextAt: bs.nextAt ?? null, cfg: { ...DEFAULT_CFG, ...(nr?.cfg || {}) } },
    seen: { tank: seen(s.tank), flow: seen(s.flow), tds: seen(s.tds) },
  });
});

app.get("/api/v1/today", (req, res) => {
  const since = midnight();
  const first = q1("SELECT tank FROM readings WHERE ts >= ? AND tank IS NOT NULL ORDER BY ts ASC LIMIT 1", since);
  res.json({
    date: istDate(since),
    tankMidnight: first ? first.tank : null,
    readings: bucket(q("SELECT ts, tank, flow, tds, pump_w FROM readings WHERE ts >= ? ORDER BY ts", since), 400),
    runs: q("SELECT * FROM pump_runs WHERE started_at >= ? OR ended_at >= ? OR ended_at IS NULL ORDER BY started_at", since, since),
    backup: q("SELECT * FROM backup_runs WHERE end_at >= ? ORDER BY start_at", since),
    probes: q("SELECT ts, good, activity FROM probes WHERE ts >= ? ORDER BY ts", since),
    events: q("SELECT * FROM events WHERE opened_at >= ? OR closed_at >= ? OR closed_at IS NULL ORDER BY opened_at", since, since),
  });
});

app.get("/api/v1/history", (req, res) => {
  const hours = Math.min(Math.max(parseInt(req.query.hours) || 24, 1), 24 * 90);
  const since = Date.now() - hours * H;
  res.json({
    hours,
    points: bucket(q("SELECT ts, tank, flow, tds, pump_w FROM readings WHERE ts >= ? ORDER BY ts", since), 600),
    runs: q("SELECT * FROM pump_runs WHERE ended_at >= ? OR ended_at IS NULL ORDER BY started_at", since),
  });
});

app.get("/api/v1/events", (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days) || 56, 1), 365);
  const since = Date.now() - days * 86400000, sinceDate = istDate(since);
  res.json({
    events: q("SELECT * FROM events WHERE opened_at >= ? ORDER BY opened_at DESC", since),
    supply: q("SELECT date, supply_day, start_ist, max_flow FROM supply_history WHERE date >= ? ORDER BY date DESC", sinceDate),
    daily: q("SELECT date, pump_minutes, fills_ok, fills_failed, kwh, tank_min, tank_max FROM daily_summary WHERE date >= ? ORDER BY date DESC", sinceDate),
    backup: q("SELECT * FROM backup_runs WHERE start_at >= ? ORDER BY start_at DESC", since),
  });
});

app.get("/api/v1/system", async (req, res) => {
  const [s, nr] = await Promise.all([haStates({ flow: ENT.flow, tank: ENT.tank, pump: ENT.pump, sub: ENT.sub, volts: ENT.volts }), controllerState()]);
  // Sensors report every few seconds, so silence means trouble. Plugs only report on change, so only "unavailable" counts.
  const dev = (key, name, detail, st, limitMin) => {
    const t = seen(st);
    const state = !st || st.state === "unavailable" ? "down" : limitMin && t && Date.now() - t > limitMin * 60000 ? "stale" : "ok";
    return { key, name, detail, state, seen: t };
  };
  const lastAi = q1("SELECT MAX(ts) ts FROM ai_calls");
  const ai = q1("SELECT COUNT(*) calls, SUM(outcome = 'ok') ok, AVG(latency_ms) avgMs FROM ai_calls WHERE ts >= ?", Date.now() - 24 * H) || {};
  const tick = nr?.lean?.lastTick || null;
  res.json({
    devices: [
      dev("esp-motor", "Pump-side sensors", "Flow, TDS and drain valve (ESP32)", s.flow, 15),
      dev("esp-tank", "Tank level sensor", "Ultrasonic, three joined 2,000 L tanks (ESP32)", s.tank, 30),
      dev("main-plug", "Main pump plug", `Tapo P110, 1.5 HP pump${num(s.volts) ? `, ${Math.round(num(s.volts))} V mains` : ""}`, s.pump, 60 * 24),
      dev("sub-plug", "Submersible plug", "Tapo plug with its own 120 min auto-off", s.sub, 0),
      { key: "controller", name: "Automatic controller", detail: "Node-RED, Controller v5", state: !nr ? "down" : tick && Date.now() - tick < 120000 ? "ok" : "stale", seen: tick },
      { key: "ai", name: "AI assistant", detail: "FreeLLMAPI on the home server", state: lastAi?.ts && Date.now() - lastAi.ts < 3 * H ? "ok" : "stale", seen: lastAi?.ts || null },
    ],
    anomalies: q("SELECT id, kind, severity, opened_at, detail, explanation FROM ai_anomalies WHERE closed_at IS NULL AND (status IS NULL OR status NOT IN ('noise', 'closed')) ORDER BY opened_at DESC LIMIT 10"),
    log: q("SELECT ts, topic, text FROM controller_log WHERE topic IS NULL OR topic NOT IN ('schedule', 'debug') ORDER BY ts DESC LIMIT 25"),
    ai: { calls: ai.calls || 0, ok: ai.ok || 0, avgMs: ai.avgMs ? Math.round(ai.avgMs) : null },
    db: {
      readings: q1("SELECT COUNT(*) n FROM readings")?.n || 0,
      events: q1("SELECT COUNT(*) n FROM events")?.n || 0,
      since: q1("SELECT MIN(ts) t FROM readings")?.t || null,
    },
  });
});

app.get("/api/v1/settings", async (req, res) => {
  const nr = await controllerState();
  if (!nr) return res.status(503).json({ error: "The automatic controller isn't reporting right now" });
  res.json({ backup: { ...DEFAULT_CFG, ...(nr.cfg || {}) } });
});

app.post("/api/v1/settings", async (req, res) => {
  const b = req.body?.backup || {};
  const cfg = {};
  const lim = { startBelow: [5, 50], leaveAtSupply: [5, 60], maxTarget: [20, 90], minHoursAway: [1, 48], maxRunMin: [10, 110] };
  for (const [k, [lo, hi]] of Object.entries(lim)) {
    if (b[k] == null) continue;
    const v = Number(b[k]);
    if (!Number.isFinite(v) || v < lo || v > hi) return res.status(400).json({ error: `${k} must be between ${lo} and ${hi}` });
    cfg[k] = Math.round(v);
  }
  // Node-RED watches this helper, checks the values again and applies them.
  try {
    const nr = await controllerState();
    const merged = { ...DEFAULT_CFG, ...(nr?.cfg || {}), ...cfg };
    await haCall("input_text", "set_value", ENT.settings, { value: JSON.stringify(merged) });
    res.json({ backup: merged });
  } catch (e) { res.status(502).json({ error: `Couldn't save: ${e.message}` }); }
});

app.post("/api/v1/control", async (req, res) => {
  const { target, on } = req.body || {};
  const entity = CONTROL[target];
  if (!entity || typeof on !== "boolean") return res.status(400).json({ error: "Unknown control" });
  try {
    if ((target === "pump" || target === "valve") && on) {
      const m = await haState(ENT.manual);
      if (sw(m) !== "on") return res.status(409).json({ error: "Turn on manual control first" });
    }
    await haCall(entity.split(".")[0], on ? "turn_on" : "turn_off", entity);
    console.log(new Date().toISOString(), "control", target, on ? "on" : "off");
    res.json({ ok: true });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ---------- older JSON endpoints, kept for existing scripts ----------
app.get("/api/tables", (req, res) => res.json(q("SELECT name FROM sqlite_master WHERE type='table'").map((t) => t.name)));
app.get("/api/table/:name", (req, res) => {
  const names = q("SELECT name FROM sqlite_master WHERE type='table'").map((t) => t.name);
  if (!names.includes(req.params.name)) return res.status(404).json({ error: "no such table" });
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  res.json(q(`SELECT * FROM "${req.params.name}" ORDER BY rowid DESC LIMIT ?`, limit));
});
app.get("/api/live", async (req, res) => {
  const s = await haStates({ tank: ENT.tank, flow: ENT.flow, tds: ENT.tds, pump: ENT.pump, valve: ENT.valve, watts: ENT.watts, volts: ENT.volts });
  res.json({ ...Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v ? v.state : null])), ts: Date.now() });
});
app.get("/api/history", (req, res) => {
  const hours = Math.min(Math.max(parseInt(req.query.hours) || 24, 1), 24 * 30);
  res.json(q("SELECT ts, tank, pump_w, tds FROM readings WHERE ts >= ? ORDER BY ts", Date.now() - hours * H));
});
app.get("/api/health", (req, res) => res.json({ ok: true, version: "1.0.0", web: fs.existsSync(path.join(WEB_DIR, "index.html")) }));

// Old page addresses now open the matching app screen.
for (const [from, to] of [["/live", "overview"], ["/today", "overview"], ["/history", "trends"]]) app.get(from, (req, res) => res.redirect(`/#/${to}`));

// ---------- web app ----------
app.use(express.static(WEB_DIR, { index: "index.html", maxAge: "1h", setHeaders: (res, p) => { if (p.endsWith("index.html")) res.set("Cache-Control", "no-cache"); } }));
app.get(/^\/(?!api\/).*/, (req, res) => {
  const f = path.join(WEB_DIR, "index.html");
  if (fs.existsSync(f)) return res.sendFile(f);
  res.status(503).send("The web app isn't installed yet. Expected it in " + WEB_DIR);
});
app.use("/api", (req, res) => res.status(404).json({ error: "No such endpoint" }));

app.listen(3000, () => console.log(`Water API 1.0 on port 3000${PASSWORD ? " (login on)" : " (no password set)"}; web from ${WEB_DIR}`));
