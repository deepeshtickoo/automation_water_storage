# Automated water supply and storage (ESP32, Home Assistant, Node-RED)

A residential water supply storage solution for a 5-storey building in Delhi NCR. Municipal water arrives roughly every other day for a few hours, at low pressure, and the first water after supply starts is often contaminated (high TDS, sewage smell). This system finds the supply, rejects bad water, pumps only clean water up to the rooftop tanks and reports what happened.

## What it does

- Detects municipal supply with short drain-valve probes, so the pump never runs dry looking for water.
- Waits out the contaminated first water, then runs 5-minute valve checks that compare TDS at the start and the end to decide whether to pump.
- Keeps filling through low-pressure spells by testing with short pump pulses every 30 minutes, and stops for the day when two pulses in a row find no good flow.
- Fills 3 x 2000 L rooftop tanks (one shared volume, about 15 m rising main): 80% is a successful fill, 95% is a completed fill.
- Keeps one daily supply record (one row per day) that the dashboard, the Telegram bot and the AI all read, so they always agree.
- Forecasts the next 7 days of supply from its own history and probes less on days no supply is expected.
- Reports through a Telegram bot (owner and family group), a Home Assistant dashboard and a daily 6 PM email.
- Optional AI layer (any OpenAI-compatible endpoint, free models by default) writes summaries, answers questions with read-only SQL tools and scores its own forecasts. The controller never depends on it.

## Plumbing

Municipal inlet -> 1.5 HP pump -> flow sensor -> TDS sensor -> T junction. One branch goes up the rising main to the tanks, the other to a sewer drain through a normally-closed drain valve. Probes and valve checks use the valve only; the pump and the valve are never on together.

## Hardware

| Part | Role |
|---|---|
| ESP32, pump side (ESPHome, motor.yaml) | TDS sensor, water flow sensor, drain valve relay |
| ESP32, tank side (ESPHome, tank.yaml) | Tank level sensor (distance type, reported as %) |
| Smart plug with power monitoring | Switches the pump, reports watts/amps/volts |
| Home Assistant OS (VM on TrueNAS Scale) | Runs Node-RED, the dashboard and helpers |

## Controller routine (v5)

- Supply day, 12:00 PM to 6:00 PM until full: open the valve for 10 s every 5 minutes until one probe sees flow.
- Water found: wait 40 minutes from first flow to let the contaminated water pass.
- Valve check: valve open 5 minutes, TDS at the start vs the end. Falling, or steady inside 100-240 ppm: 50 s pump pulse. Rising: no pump, check again 15 minutes later. No flow through the valve: a pump pulse tests the water instead.
- Pump pulse: if TDS is in range at 50 s, keep filling; otherwise stop and go back to valve checks every 15 minutes.
- While filling: tank 95% ends the day. Flow 19 L/min or below, or a dry run, stops the pump; pump pulses then run every 30 minutes, and two pulses in a row with no good flow end the day. TDS leaving the range goes back to valve checks. A single run is capped at 2 hours, followed by a 2-minute rest and a new pulse.
- If the pump-side ESP32 drops off Wi-Fi while filling, the pump keeps running for up to 5 minutes, using the plug power reading as the dry-run check.
- No-supply day (from the 7-day forecast): probe every 30 minutes, 12:00 PM to 4:00 PM only. Any flow switches to the supply-day routine.
- Manual mode from the dashboard pauses the controller and returns to automatic after 1h 30m.

## Node-RED flow (node-red/flows.json)

Everything runs in one tab, Water System, split into labelled sections:

- Unified: SQLite recorder, dashboard values, 6 PM email and the daily supply record.
- Controller: probes, valve checks, pump pulses, the ESP32 dropout guard, the event layer (one supply event per day) and the supply window learner.
- Telegram bot: /status, /week, /insights, free chat (owner), owner-only settings (/window, /tds) applied after /yes, access by /join with owner approval (/users), live updates and group notices.
- AI core, context and tools, diagnostics: model routing with fallbacks, call budget, read-only tools, agent loop, model bench.
- Forecast: AI forecast (shadow, scored) and the 7-day supply forecast (code only, no AI).
- Anomalies and digests.

## Install

1. ESPHome: copy secrets.yaml.example to secrets.yaml, fill it in, then flash motor.yaml and tank.yaml.
2. Node-RED: import node-red/flows.json and install any missing palette nodes (Home Assistant websocket nodes, node-red-node-sqlite, node-red-contrib-telegrambot, node-red-node-email and the LLM nodes used by the flows).
3. Set your own values: Home Assistant server, entity IDs, Telegram bot token and chat IDs (placeholders 123456789 and -1001234567890), email account, AI endpoint and key (the ai-cfg node).
4. Create the Home Assistant helpers used by the flows: input_boolean.water_manual_control, input_boolean.water_ai_enabled and the input_text.water_* status helpers.

## Versioning

This repository is updated automatically from the live system by a Node-RED Git Sync flow: one pull request per noteworthy change, plus a nightly 11 PM sync that publishes only when the flows changed. See CHANGELOG.md. Keys, tokens, chat IDs, email addresses and private hostnames are redacted before publishing.
