const express = require("express");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const DB_PATH = process.env.WATER_DB || "/addon_configs/a0d7b954_nodered/node-red/water.db";
const db = new DatabaseSync(DB_PATH, { readOnly: true });
const app = express();
const IST = 330 * 60000;

// ---------- login (username and password from the app's Configuration tab) ----------
let USERNAME = process.env.WATER_USERNAME || "";
let PASSWORD = process.env.WATER_PASSWORD || "";
try {
  const opts = JSON.parse(fs.readFileSync("/data/options.json", "utf8"));
  USERNAME = opts.username || USERNAME;
  PASSWORD = opts.password || PASSWORD;
} catch {}

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
    const pass = rest.join(":");
    if (same(pass, PASSWORD) && (!USERNAME || same(user, USERNAME))) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="Water API"').status(401).send("Login required");
});

const ENT = {
  tank: "sensor.esp32_tank_water_level",
  flow: "sensor.esp32_motor_water_flow_rate",
  tds: "sensor.esp32_motor_tds_sensor_ppm",
  pump: "switch.water_motor_pump",
  valve: "switch.esp32_motor_drain_valve_switch",
  watts: "sensor.water_motor_pump_current_consumption",
  volts: "sensor.water_motor_pump_voltage",
};

const tables = () =>
  db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);

const midnight = () => {
  const d = new Date(Date.now() + IST);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime() - IST;
};
const time = ms => new Date(ms + IST).toISOString().slice(11, 16);
const r1 = n => (n == null ? "-" : Math.round(n * 10) / 10);

const page = (title, body, extra = "") => `<!doctype html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
body{font-family:system-ui,sans-serif;margin:0;padding:16px;background:#0f1419;color:#e6e6e6}
h1{font-size:22px;margin:0 0 4px}.sub{color:#8a96a3;font-size:13px;margin-bottom:16px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.card{background:#1a222b;border-radius:12px;padding:14px}
.lbl{color:#8a96a3;font-size:13px}.val{font-size:28px;font-weight:600;margin-top:4px}
.on{color:#4ade80}.off{color:#8a96a3}.bad{color:#f87171}
.bar{height:10px;background:#2a3540;border-radius:5px;margin-top:8px;overflow:hidden}
.bar div{height:100%;background:#38bdf8}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:14px}
td,th{text-align:left;padding:6px 4px;border-bottom:1px solid #2a3540}
a{color:#38bdf8}nav{margin-bottom:16px}nav a{margin-right:14px}
</style></head><body>
<nav><a href="/live">Live</a><a href="/today">Today</a><a href="/history">History</a><a href="/">Tables</a></nav>
${body}${extra}</body></html>`;

// ---------- raw tables ----------
app.get("/api/tables", (req, res) => res.json(tables()));

app.get("/api/table/:name", (req, res) => {
  const name = req.params.name;
  if (!tables().includes(name)) return res.status(404).json({ error: "no such table" });
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  res.json(db.prepare(`SELECT * FROM "${name}" ORDER BY rowid DESC LIMIT ?`).all(limit));
});

app.get("/", (req, res) => {
  const links = tables().map(t => `<li><a href="/api/table/${t}">${t}</a></li>`).join("");
  res.send(page("Water API", `<h1>Tables</h1><ul>${links}</ul>`));
});

// ---------- today ----------
function today() {
  const since = midnight();
  const latest = db.prepare("SELECT * FROM readings ORDER BY ts DESC LIMIT 1").get();
  const first = db.prepare("SELECT tank FROM readings WHERE ts >= ? ORDER BY ts ASC LIMIT 1").get(since);
  const runs = db.prepare("SELECT * FROM pump_runs WHERE started_at >= ? ORDER BY started_at").all(since);
  const events = db.prepare(
    "SELECT * FROM events WHERE opened_at >= ? OR closed_at >= ? OR closed_at IS NULL ORDER BY opened_at"
  ).all(since, since);
  const probes = db.prepare("SELECT COUNT(*) n, SUM(good) good FROM probes WHERE ts >= ?").get(since);
  return {
    date: new Date(since + IST).toISOString().slice(0, 10),
    tank_now: latest ? latest.tank : null,
    tank_at_midnight: first ? first.tank : null,
    last_reading: latest ? latest.ts : null,
    pump_minutes: runs.reduce((s, r) => s + (r.minutes || 0), 0),
    pump_runs: runs,
    events,
    probes: probes.n || 0,
    good_probes: probes.good || 0,
  };
}

app.get("/api/today", (req, res) => res.json(today()));

app.get("/today", (req, res) => {
  const t = today();
  const change = t.tank_now != null && t.tank_at_midnight != null ? t.tank_now - t.tank_at_midnight : null;
  const fills = t.events.filter(e => e.grade === "successful").length;
  const runRows = t.pump_runs.map(r =>
    `<tr><td>${time(r.started_at)}</td><td>${r1(r.minutes)} min</td><td>${r1(r.tank_start)}% → ${r1(r.tank_end)}%</td><td>${r.stop_reason || ""}</td></tr>`
  ).join("") || `<tr><td colspan="4" class="off">No pump runs today</td></tr>`;
  const evRows = t.events.map(e =>
    `<tr><td>${time(e.opened_at)}${e.closed_at ? "–" + time(e.closed_at) : " (open)"}</td><td class="${e.grade === "successful" ? "on" : e.grade ? "bad" : ""}">${(e.grade || e.kind || "").replace(/_/g, " ")}</td><td>${e.reason || ""}</td></tr>`
  ).join("") || `<tr><td colspan="3" class="off">No supply events today</td></tr>`;

  res.send(page("Today", `
<h1>Today</h1><div class="sub">${t.date}${t.last_reading ? " · last reading " + time(t.last_reading) : ""}</div>
<div class="grid">
 <div class="card"><div class="lbl">Tank now</div><div class="val">${r1(t.tank_now)}%</div>
  <div class="bar"><div style="width:${Math.max(0, Math.min(100, t.tank_now || 0))}%"></div></div></div>
 <div class="card"><div class="lbl">Since midnight</div><div class="val ${change > 0 ? "on" : ""}">${change == null ? "-" : (change > 0 ? "+" : "") + r1(change) + "%"}</div></div>
 <div class="card"><div class="lbl">Pump time</div><div class="val">${r1(t.pump_minutes)} min</div></div>
 <div class="card"><div class="lbl">Successful fills</div><div class="val">${fills}</div></div>
 <div class="card"><div class="lbl">Supply checks</div><div class="val">${t.good_probes}/${t.probes}</div><div class="lbl">found good water</div></div>
</div>
<h2>Pump runs</h2><table><tr><th>Start</th><th>Time</th><th>Tank</th><th>Stopped because</th></tr>${runRows}</table>
<h2>Supply events</h2><table><tr><th>When</th><th>Result</th><th>Why</th></tr>${evRows}</table>`));
});

// ---------- live (from Home Assistant) ----------
async function state(id) {
  const r = await fetch(`http://supervisor/core/api/states/${id}`, {
    headers: { Authorization: `Bearer ${process.env.SUPERVISOR_TOKEN}` },
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.state;
}

app.get("/api/live", async (req, res) => {
  try {
    const out = {};
    await Promise.all(Object.entries(ENT).map(async ([k, id]) => (out[k] = await state(id))));
    out.ts = Date.now();
    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/live", (req, res) => {
  res.send(page("Live", `
<h1>Water system</h1><div class="sub">Live · updates every 5 s · <span id="ts">loading…</span></div>
<div class="grid">
 <div class="card"><div class="lbl">Tank</div><div class="val" id="tank">-</div><div class="bar"><div id="tankbar" style="width:0"></div></div></div>
 <div class="card"><div class="lbl">Pump</div><div class="val" id="pump">-</div><div class="lbl" id="watts"></div></div>
 <div class="card"><div class="lbl">Drain valve</div><div class="val" id="valve">-</div></div>
 <div class="card"><div class="lbl">Flow</div><div class="val" id="flow">-</div></div>
 <div class="card"><div class="lbl">TDS</div><div class="val" id="tds">-</div></div>
 <div class="card"><div class="lbl">Mains voltage</div><div class="val" id="volts">-</div></div>
</div>`, `<script>
const n = v => (v == null || isNaN(+v)) ? null : Math.round(+v * 10) / 10;
const sw = (el, v) => { el.textContent = v == null ? "?" : v.toUpperCase(); el.className = "val " + (v === "on" ? "on" : "off"); };
async function tick() {
  try {
    const d = await (await fetch("/api/live")).json();
    const t = n(d.tank);
    document.getElementById("tank").textContent = t == null ? "?" : t + "%";
    document.getElementById("tankbar").style.width = Math.max(0, Math.min(100, t || 0)) + "%";
    sw(document.getElementById("pump"), d.pump);
    sw(document.getElementById("valve"), d.valve);
    document.getElementById("watts").textContent = n(d.watts) == null ? "" : n(d.watts) + " W";
    document.getElementById("flow").textContent = n(d.flow) == null ? "?" : n(d.flow) + " L/min";
    document.getElementById("tds").textContent = n(d.tds) == null ? "?" : Math.round(d.tds) + " ppm";
    document.getElementById("volts").textContent = n(d.volts) == null ? "?" : Math.round(d.volts) + " V";
    document.getElementById("ts").textContent = new Date(d.ts).toLocaleTimeString();
  } catch (e) { document.getElementById("ts").textContent = "can't reach server"; }
}
tick(); setInterval(tick, 5000);
</script>`));
});

// ---------- history charts ----------
function history(hours) {
  const since = Date.now() - hours * 3600000;
  return db.prepare("SELECT ts, tank, pump_w, tds FROM readings WHERE ts >= ? ORDER BY ts").all(since);
}

app.get("/api/history", (req, res) => {
  const hours = Math.min(Math.max(parseInt(req.query.hours) || 24, 1), 24 * 30);
  res.json(history(hours));
});

function chart(rows, key, { color, unit, min, max, w = 480, h = 220 }) {
  const pad = { l: 52, r: 8, t: 10, b: 26 };
  const pts = rows.filter(r => r[key] != null);
  if (pts.length < 2) return `<div class="off">Not enough data</div>`;
  const t0 = pts[0].ts, t1 = pts[pts.length - 1].ts;
  const vals = pts.map(r => r[key]);
  const lo = min ?? Math.min(...vals), hi = max ?? Math.max(...vals, lo + 1);
  const X = t => pad.l + ((t - t0) / (t1 - t0 || 1)) * (w - pad.l - pad.r);
  const Y = v => pad.t + (1 - (v - lo) / (hi - lo || 1)) * (h - pad.t - pad.b);
  const line = pts.map((r, i) => `${i ? "L" : "M"}${X(r.ts).toFixed(1)},${Y(r[key]).toFixed(1)}`).join("");
  const grid = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const v = lo + f * (hi - lo), y = Y(v).toFixed(1);
    return `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}" stroke="#2a3540"/>
<text x="${pad.l - 6}" y="${+y + 4}" fill="#8a96a3" font-size="13" text-anchor="end">${Math.round(v)}${unit}</text>`;
  }).join("");
  const span = t1 - t0, ticks = 4;
  const xl = Array.from({ length: ticks + 1 }, (_, i) => {
    const t = t0 + (span * i) / ticks, d = new Date(t + IST).toISOString();
    const label = span > 2 * 86400000 ? d.slice(5, 10) : d.slice(11, 16);
    return `<text x="${X(t).toFixed(1)}" y="${h - 6}" fill="#8a96a3" font-size="13" text-anchor="${i === 0 ? "start" : i === ticks ? "end" : "middle"}">${label}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">${grid}${xl}
<path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/></svg>`;
}

app.get("/history", (req, res) => {
  const hours = Math.min(Math.max(parseInt(req.query.hours) || 24, 1), 24 * 30);
  const rows = history(hours);
  const pick = [[24, "24 hours"], [72, "3 days"], [168, "7 days"], [720, "30 days"]]
    .map(([h, l]) => h === hours ? `<b>${l}</b>` : `<a href="/history?hours=${h}">${l}</a>`).join(" · ");
  res.send(page("History", `
<h1>History</h1><div class="sub">${pick}</div>
<div class="card"><div class="lbl">Tank level</div>${chart(rows, "tank", { color: "#38bdf8", unit: "%", min: 0, max: 100 })}</div>
<div class="card" style="margin-top:10px"><div class="lbl">Pump power</div>${chart(rows, "pump_w", { color: "#4ade80", unit: " W", min: 0 })}</div>
<div class="card" style="margin-top:10px"><div class="lbl">TDS</div>${chart(rows, "tds", { color: "#fbbf24", unit: "", min: 0 })}</div>`));
});

app.listen(3000, () => console.log(`Water API on port 3000${PASSWORD ? " (login on)" : " (no password set)"}`));
