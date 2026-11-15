// Starts the real server against a throwaway database and checks the pages and the login.
const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { spawn } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "water-api-"));
const dbPath = path.join(dir, "water.db");
const BASE = "http://127.0.0.1:3000";
let server;

function seed() {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE readings(ts, tank, flow, tds, pump, valve, pump_w);
    CREATE TABLE events(id, opened_at, closed_at, kind, grade, reason, runs);
    CREATE TABLE pump_runs(id, started_at, ended_at, minutes, stop_reason, tank_start, tank_end);
    CREATE TABLE probes(id, ts, good);
  `);
  const now = Date.now();
  const ins = db.prepare("INSERT INTO readings VALUES (?,?,?,?,?,?,?)");
  for (let i = 0; i < 300; i++) ins.run(now - i * 300000, 50 + (i % 40), 0, 300, 0, 0, i % 50 < 5 ? 1200 : 0);
  db.prepare("INSERT INTO pump_runs VALUES (1, ?, ?, 20, 'tank reached 95%', 40, 60)").run(now - 3600000, now - 2400000);
  db.close();
}

async function waitUp() {
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + "/api/tables"); return; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error("server did not start");
}

const auth = (u, p) => ({ Authorization: "Basic " + Buffer.from(`${u}:${p}`).toString("base64") });
const OK = auth("tester", "test-pass");

before(async () => {
  seed();
  server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, WATER_DB: dbPath, WATER_USERNAME: "tester", WATER_PASSWORD: "test-pass" },
    stdio: "ignore",
  });
  await waitUp();
});

after(() => {
  server.kill();
  fs.rmSync(dir, { recursive: true, force: true });
});

test("pages need a login", async () => {
  assert.equal((await fetch(BASE + "/today")).status, 401);
  assert.equal((await fetch(BASE + "/today", { headers: auth("tester", "wrong") })).status, 401);
  assert.equal((await fetch(BASE + "/today", { headers: auth("someone", "test-pass") })).status, 401);
});

test("tables endpoint lists the database tables", async () => {
  const res = await fetch(BASE + "/api/tables", { headers: OK });
  assert.equal(res.status, 200);
  assert.ok((await res.json()).includes("readings"));
});

test("unknown table is a 404, not a query", async () => {
  const res = await fetch(BASE + "/api/table/readings%3B%20DROP%20TABLE%20readings", { headers: OK });
  assert.equal(res.status, 404);
});

test("today summary has the latest tank level", async () => {
  const body = await (await fetch(BASE + "/api/today", { headers: OK })).json();
  assert.equal(typeof body.tank_now, "number");
  assert.ok(Array.isArray(body.pump_runs));
});

test("history returns readings and draws three charts", async () => {
  const data = await (await fetch(BASE + "/api/history?hours=24", { headers: OK })).json();
  assert.ok(data.length > 100);
  const html = await (await fetch(BASE + "/history?hours=24", { headers: OK })).text();
  assert.equal(html.match(/<svg/g).length, 3);
});
