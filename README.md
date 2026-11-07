# Automated water supply and storage (ESP32, Home Assistant, Node-RED)

A residential water supply storage solution for a 5-storey building in Delhi NCR. Municipal water arrives roughly every other day for a few hours, at low pressure, and the first water after supply starts is often contaminated (high TDS, sewage smell). This system finds the supply, rejects bad water, pumps only clean water up to the rooftop tanks and reports what happened.

## What it does

- Detects municipal supply with short drain-valve probes, so the pump never runs dry looking for water.
- Waits out the contaminated first water, then runs drain tests that compare TDS before and after to decide whether to pump.
- Keeps filling late in a supply day, when line pressure is too low for the valve to show flow, by testing with short pump pulses.
- Fills 3 x 2000 L rooftop tanks (one shared volume, about 15 m rising main): 80% is a successful fill, 95% is a completed fill.
- Forecasts the next 7 days of supply from its own history and probes less on days no supply is expected.
- Reports through a Telegram bot (owner and family group), a Home Assistant dashboard and a daily 6 PM email.
- Optional AI layer (any OpenAI-compatible endpoint) writes summaries, answers questions with read-only SQL tools and scores its own forecasts. The controller never depends on it.

## Plumbing

Municipal inlet -> 1.5 HP pump -> flow sensor -> TDS sensor -> T junction. One branch goes up the rising main to the tanks, the other to a sewer drain through a normally-closed drain valve. Probing and drain tests use the valve only; the pump and the valve are never on together.

## Hardware

| Part | Role |
|---|---|
| ESP32, pump side (ESPHome, motor.yaml) | TDS sensor, water flow sensor, drain valve relay |
| ESP32, tank side (ESPHome, tank.yaml) | Tank level sensor (distance type, reported as %) |
| Smart plug with power monitoring | Switches the pump, reports watts/amps/volts |
| Home Assistant OS (VM on TrueNAS Scale) | Runs Node-RED, the dashboard and helpers |

## Controller routine (tab: Water System (Lean))

- Supply day: from 12:00 PM to 6:00 PM, open the valve for 10 s every 5 minutes to look for flow.
- First flow: stop probing for 33 minutes to let the contaminated water pass.
- Drain test: valve open 5 minutes, TDS before vs after. Falling, or steady inside 100-240 ppm: 50 s pump pulse, then keep filling while TDS stays in range. Rising: no pump, test again every 15 minutes.
- Pump probes: once a fill has proven the supply (10 minutes, tank up 3 points, good flow and TDS), a valve check that sees no flow switches to a 50 s pump test every 15 minutes. Two dry tests in a row, or a pump-probe fill that raises the tank less than 2 points in 20 minutes, ends pump probes for the day.
- Stops: tank 95% (done for the day), TDS out of range, dry run, supply lost, 2-hour cap per pump run.
- No-supply day (from the 7-day forecast): probe every 30 minutes, 12:00 PM to 4:00 PM only. Any flow switches to the supply-day routine.
- Manual mode from the dashboard pauses the controller and returns to automatic after 1h 30m.

## Node-RED tabs (node-red/flows.json)

- Water System (Lean): controller, event layer (one supply event per day, with fill, successful, completed and failed fills), supply window learner.
- Water System (Unified): SQLite recorder, dashboard values, 6 PM email, day forecast.
- Water AI Core, Context and Tools, Forecast (shadow), Anomalies and Digests, Diagnostics: model routing with fallbacks, call budget, read-only tools, agent loop, forecast scoring.
- Water Telegram Chat: /status, /week, /insights, free chat, owner-only settings (/window, /tds) applied after /yes, live updates and group notices.
- The 7-day supply forecast lives in the Forecast tab (code only, no AI).

## Install

1. ESPHome: copy secrets.yaml.example to secrets.yaml, fill it in, then flash motor.yaml and tank.yaml.
2. Node-RED: import node-red/flows.json and install any missing palette nodes (Home Assistant websocket nodes, node-red-node-sqlite, node-red-contrib-telegrambot, node-red-node-email and the LLM nodes used by the flows).
3. Set your own values: Home Assistant server, entity IDs, Telegram bot token and chat IDs (placeholders 123456789 and -1001234567890), email account, AI endpoint and key (the ai-cfg node).
4. Create the Home Assistant helpers used by the flows: input_boolean.water_manual_control, input_boolean.water_ai_enabled and the input_text.water_* status helpers.

## Versioning

This repository is updated automatically from the live system by a Node-RED Git Sync flow: one pull request per noteworthy change, plus a nightly 11 PM sync that publishes only when the flows changed. See CHANGELOG.md. Keys, tokens, chat IDs, email addresses and private hostnames are redacted before publishing.
