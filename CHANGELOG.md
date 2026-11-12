# Changelog

Published automatically from the live Node-RED instance.

## v1.2.2 (2026-11-12)

Nightly sync: changes in Water System.

## v1.2.1 (2026-11-08)

Cleanup: removed the old switched-off controller (v5) and everything that only fed it (Water Day / No Water Day buttons, old Day selector route), the orphaned AI summary node and its error nodes, 3 old disabled water tabs and 7 empty tabs. The two 1-second ticks are merged into one. Manual test buttons (model bench, AI tests, call log, schema, count rows) moved to a new Water Tools tab. 343 to 268 nodes; no change to how the water system runs.

## v1.2.1 (2026-11-08)

Cleanup: removed the old switched-off controller (v5) and everything that only fed it (Water Day / No Water Day buttons, old Day selector route), the orphaned AI summary node and its error nodes, 3 old disabled water tabs and 7 empty tabs. The two 1-second ticks are merged into one. Manual test buttons (model bench, AI tests, call log, schema, count rows) moved to a new Water Tools tab. 343 to 268 nodes; no change to how the water system runs.

## v1.2.0 (2026-11-08)

All water flows merged into one Node-RED tab, Water System, with labelled sections (Unified, Controller, Telegram bot, AI core, AI context and tools, AI diagnostics, Forecast, Anomalies and digests). One daily supply record (one row per day) is now read by the dashboard Previous card, the Telegram bot and the AI context, so they always agree; pump time comes from the minute readings, which fixes inflated totals on 29 Oct and 4 Nov. The bot agent now uses gemini-3.6-flash first with nemotron as fallback (free models only). Free chat stays on after restarts. Changelog messages are no longer cut at 300 characters.

## v1.2.0 (2026-11-08)

All water flows merged into one Node-RED tab, Water System, with labelled sections (Unified, Controller, Telegram bot, AI core, AI context and tools, AI diagnostics, Forecast, Anomalies and digests). One daily supply record (one row per day) is now read by the dashboard Previous card, the Telegram bot and the AI context, so they always agree; pump time comes from the minute readings, which fixes inflated totals on 29 Oct and 4 Nov. The bot agent now uses gemini-3.6-flash first with nemotron as fallback (free models only). Free chat stays on after restarts. Changelog messages are no longer cut at 300 characters.

## v1.2.0 (2026-11-07)

All water flows merged into one Node-RED tab, Water System, with labelled sections (Unified, Controller, Telegram bot, AI core, AI context and tools, AI diagnostics, Forecast, Anomalies and digests). One daily supply record (one row per day) is now read by the dashboard Previous card, the Telegram bot and the AI context, so they always agree; pump time comes from the minute readings, which fixes inflated totals on 29 Oct and 4 Nov. The bot agent now uses gemini-3.6-flash first with nemotron as fallback (free models only). Free chat stays on after restarts. Changelog messages are no longer cut at 300 characters.

## v1.1.0 (2026-11-07)

Supply events: one per day, flow drops inside the probe window no longer split it, and the Previous card covers the whole supply day. All texts say supply event and show durations over 59 min as Xh MMm. Pump probe mode keeps filling late in a supply day when the valve sees no flow. Status card with 

## v1.0.0 (2026-11-02)

First full publish: live Lean controller, event layer, 7-day forecast, recorder, Telegram bot and AI layer; ESPHome secrets moved to secrets.yaml
