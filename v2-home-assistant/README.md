# v2: Smart-plug pump, tank level %, flow + TDS check (Home Assistant)

> **Current system.** Node-RED is gone. All logic runs as native Home Assistant
> automations, exported in [`automations/`](automations/) and
> [`scripts/`](scripts/).

## What changed from v1

| | v1 | v2 |
|---|---|---|
| Pump | Two relay-switched motors on `esp32-motor` | One pump on a TP-Link smart plug (`switch.water_motor_pump`), which also reports power and runtime |
| Tank sensing | Two XKC-Y25V full / not-full sensors | One continuous level sensor (`sensor.esp32_tank_water_level`, %) |
| Supply check | TDS probe only | Drain valve opens for 10 s, then **flow > 10 L/min and TDS 100–220 ppm** are checked |
| Logic | Node-RED flow | HA automations |
| Alerts | None | HA notification + WhatsApp (Green API via `rest_command`) |

## How it works

**Starting the pump:** the supply check automation.

- Normal mode: every 15 min, 12:00–17:30.
- Emergency mode (`input_boolean.water_check_emergency_mode` on): every hour,
  around the clock.
- It runs only when the tank is **below 80%**, the pump is off, and the drain
  valve is closed.

Each check opens the drain valve for 10 s and reads flow and TDS. If both are in
range, it closes the valve, waits for the valve to report closed, then starts
the pump. Otherwise the valve closes and the pump stays off until the next check.

**Stopping the pump:** any of these turns it off.

| Condition | Automation |
|---|---|
| Tank above 95% for 5 min | `If_tank_level_above_95_for_5min…` |
| Flow never goes above 10 L/min within 5 min of the pump starting | `If_flow_not_above_10_for_5min…` |
| TDS below 100 for 90 s | `If_tds_falls_below_100_for_90s…` |
| TDS above 220 for 90 s | `If_tds_jumps_over_220_for_90s…` |
| 18:00, normal mode only | `At_6pm_turn_pump_off_and_close_drain_valve` |

**Safety:**

- **Interlock:** the pump and the drain valve are never on together. Whichever
  turned on last is switched off.
- **Watchdog:** closes the drain valve if it has been open for 3 min, or if it
  is open when HA starts.

**Notifications:**

- After each on-the-hour check, a status message (flow, TDS, pump, runtime,
  tank) goes to HA and WhatsApp. That's hourly 12:00–17:00 in normal mode, and
  every 6 h in emergency mode.
- A daily report with tank level and pump runtime is sent on WhatsApp at 18:00.

**Manual test:** `script.test_water_supply_90s` opens the valve and reports the
readings without starting the pump. It has bugs; see Known issues.

## Live state on 2026-10-17

When these files were exported, **every automation above was disabled except
the 18:00 WhatsApp report.** The pump isn't automated in that state, and none of
the stop or safety automations are protecting it. If this is intentional (for
example, a pause for maintenance), turn on at least the stop and safety
automations whenever the pump can be switched on by hand.

## Known issues

These are in the live HA config. The exports copy them as they are, unfixed:

1. **`test_water_supply_90s` is broken.** It never reads `flow`, `tds`
   or `verdict`, so its report comes out blank. It also keeps the valve open
   for 100 s (90 s + 10 s delays), while its name says 10 s.
2. **Entity IDs no longer match behaviour.** For example,
   `automation.every_hour_at_02min_if_tank_below_90_then_turn_pump_on` runs
   every 15 min below **80%**, and `…tds_falls_below_100_for_1min…` waits 90 s.
   Renaming these is safe as long as nothing else references them.
3. **Four automations target the pump by `device_id`.** If the plug is ever
   re-added, these break silently. Switch them to
   `entity_id: switch.water_motor_pump`.
4. **No failsafe on the pump.** If HA is down while the pump runs, nothing turns
   it off. The TP-Link plug has a built-in auto-off
   (`switch.water_motor_pump_auto_off_enabled`, currently **off**, with
   `number.water_motor_pump_turn_off_in` = 120 min). Turning it on adds a
   failsafe that doesn't depend on HA.

## Files

```
automations/water_automations.yaml   all 10 water automations
scripts/test_water_supply.yaml       manual supply test
esphome/                             v2 board configs (not committed yet; see README there)
```

The `rest_command.send_water_alert_whatsapp` definition is not included because
it contains the Green API token. It goes in `configuration.yaml`, with the token
in HA's `secrets.yaml`.
