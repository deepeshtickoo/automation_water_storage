// Starts the real server against a throwaway database and checks the API, the login and the web app.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "water-api-"));
const dbPath = path.join(dir, "water.db");
const webDir = path.join(dir, "web");
const BASE = "http://127.0.0.1:3000";
let server;

function seed() {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE readings(ts INTEGER PRIMARY KEY, tank REAL, flow REAL, tds REAL, pump INTEGER, valve INTEGER, pump_w REAL);
    CREATE TABLE events(id TEXT PRIMARY KEY, opened_at INTEGER, closed_at INTEGER, kind TEXT, grade TEXT, reason TEXT, runs INTEGER, pumped_min REAL, tank_start REAL, tank_max REAL, tank_end REAL);
    CREATE TABLE pump_runs(id INTEGER PRIMARY KEY, started_at INTEGER, ended_at INTEGER, minutes REAL, stop_reason TEXT, category TEXT, tank_start REAL, tank_end REAL, avg_power_w REAL, event_id TEXT);
    CREATE TABLE probes(id INTEGER PRIMARY KEY, ts INTEGER, activity INTEGER, good INTEGER);
    CREATE TABLE supply_history(date TEXT PRIMARY KEY, supply_day INTEGER, mean_flow REAL, max_flow REAL, start_ist TEXT, note TEXT);
    CREATE TABLE daily_summary(date TEXT PRIMARY KEY, pump_minutes REAL, fills_ok INTEGER, fills_failed INTEGER, false_positives INTEGER, probes INTEGER, kwh REAL, tank_min REAL, tank_max REAL, updated_at INTEGER);
    CREATE TABLE backup_runs(id INTEGER PRIMARY KEY, start_at INTEGER, end_at INTEGER, tank_start REAL, tank_end REAL, target REAL, minutes INTEGER, reason TEXT, failed INTEGER);
    CREATE TABLE controller_log(id INTEGER PRIMARY KEY, ts INTEGER, topic TEXT, text TEXT);
    CREATE TABLE ai_calls(id INTEGER PRIMARY KEY, ts INTEGER, outcome TEXT, latency_ms INTEGER);
    CREATE TABLE ai_anomalies(id INTEGER PRIMARY KEY, kind TEXT, opened_at INTEGER, closed_at INTEGER, severity TEXT, status TEXT, detail TEXT, explanation TEXT);
  `);
  const now = Date.now();
  const ins = db.prepare("INSERT INTO readings VALUES (?,?,?,?,?,?,?)");
  for (let i = 0; i < 2000; i++) ins.run(now - i * 60000, 50 + (i % 40), 0, 120, 0, 0, i % 50 < 5 ? 1200 : 0);
  db.prepare("INSERT INTO pump_runs VALUES (1, ?, ?, 20, 'tank reached 92%', 'tank_full', 40, 60, 1250, 'e1')").run(now - 3600000, now - 2400000);
  db.prepare("INSERT INTO events VALUES ('e1', ?, ?, 'completed', 'successful', 'completed fill', 1, 20, 40, 60, 60)").run(now - 4000000, now - 2400000);
  db.prepare("INSERT INTO backup_runs VALUES (1, ?, ?, 18, 30, 40, 22, 'target 40% reached', 0)").run(now - 9000000, now - 7680000);
  db.close();
  fs.mkdirSync(webDir);
  fs.writeFileSync(path.join(webDir, "index.html"), "<!doctype html><title>Water storage</title><div id=root></div>");
}

async function waitUp() {
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + "/api/health"); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error("server did not start");
}

const auth = (u, p) => ({ Authorization: "Basic " + Buffer.from(`${u}:${p}`).toString("base64") });
const OK = auth("tester", "test-pass");
const get = async (p) => (await fetch(BASE + p, { headers: OK })).json();

before(async () => {
  seed();
  server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: {
      ...process.env, WATER_DB: dbPath, WATER_WEB: webDir, WATER_USERNAME: "tester", WATER_PASSWORD: "test-pass",
      WATER_SECRETS: path.join(dir, "none.json"), SUPERVISOR_TOKEN: "x",
    },
    stdio: "ignore",
  });
  await waitUp();
});

after(() => {
  server.kill();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("everything needs a login", async () => {
  assert.equal((await fetch(BASE + "/")).status, 401);
  assert.equal((await fetch(BASE + "/api/v1/today", { headers: auth("tester", "wrong") })).status, 401);
  assert.equal((await fetch(BASE + "/api/v1/today", { headers: auth("someone", "test-pass") })).status, 401);
});

test("the web app is served for app routes but not for the API", async () => {
  const html = await (await fetch(BASE + "/supply", { headers: OK })).text();
  assert.match(html, /Water storage/);
  assert.equal((await fetch(BASE + "/api/nope", { headers: OK })).status, 404);
});

test("old page addresses open the matching app screen", async () => {
  const res = await fetch(BASE + "/history", { headers: OK, redirect: "manual" });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get("location"), "/#/trends");
});

test("today has readings, runs, top-ups and the midnight level", async () => {
  const t = await get("/api/v1/today");
  assert.match(t.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(t.readings) && t.readings.length <= 400);
  assert.ok(Array.isArray(t.runs));
  assert.ok(Array.isArray(t.backup));
});

test("history is thinned out for charts", async () => {
  const h = await get("/api/v1/history?hours=48");
  assert.equal(h.hours, 48);
  assert.ok(h.points.length > 100 && h.points.length <= 600, `got ${h.points.length} points`);
  assert.equal(h.runs.length, 1);
});

test("events list supply events and top-ups", async () => {
  const e = await get("/api/v1/events?days=7");
  assert.equal(e.events[0].id, "e1");
  assert.equal(e.backup[0].reason, "target 40% reached");
});

test("now still answers when Home Assistant and Node-RED are out of reach", async () => {
  const n = await get("/api/v1/now");
  assert.equal(n.ctrl.online, false);
  assert.equal(n.backup.cfg.startBelow, 20);
});

test("controls and settings check their input", async () => {
  const post = (p, body) => fetch(BASE + p, { method: "POST", headers: { ...OK, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await post("/api/v1/control", { target: "garage", on: true })).status, 400);
  assert.equal((await post("/api/v1/control", { target: "pump", on: "yes" })).status, 400);
  assert.equal((await post("/api/v1/settings", { backup: { startBelow: 95 } })).status, 400);
});

test("raw tables stay safe from injection", async () => {
  assert.ok((await get("/api/tables")).includes("readings"));
  assert.equal((await fetch(BASE + "/api/table/readings%3B%20DROP%20TABLE%20readings", { headers: OK })).status, 404);
});
