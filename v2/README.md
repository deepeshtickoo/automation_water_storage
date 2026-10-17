# v2: Smart-plug pump, tank level %, flow + TDS check (Node-RED)

> **Current system.** As in v1, a Node-RED flow in the HAOS add-on decides when
> the pump runs. The hardware is new.
>
> **The v2 flow isn't in this repo yet.** See [`node-red/README.md`](node-red/README.md)
> for how to export it.

## What changed from v1

| | v1 | v2 |
|---|---|---|
| Pump | Two relay-switched motors on `esp32-motor` | One pump on a TP-Link smart plug (`switch.water_motor_pump`), which also reports power and runtime |
| Tank sensing | Two XKC-Y25V full / not-full sensors | One continuous level sensor (`sensor.esp32_tank_water_level`, %) |
| Supply check | TDS probe only | Drain valve (`switch.esp32_motor_drain_valve_switch`) plus flow meter (`sensor.esp32_motor_water_flow_rate`) and TDS |
| Logic | Node-RED | Node-RED (new flow) |

## Entities the flow works with

| Entity | What it is |
|---|---|
| `switch.water_motor_pump` | TP-Link smart plug feeding the pump |
| `switch.esp32_motor_drain_valve_switch` | Drain valve on the supply line |
| `sensor.esp32_motor_tds_sensor_ppm` | Gravity TDS probe |
| `sensor.esp32_motor_water_flow_rate` | Flow meter, L/min |
| `sensor.esp32_tank_water_level` | Tank level, % |
| `input_boolean.water_check_emergency_mode` | Emergency-mode switch |
| `sensor.water_motor_pump_runtime_today` | `history_stats` helper, pump hours since midnight |

This list comes from Home Assistant. Check it against the flow once it's exported.

## Home Assistant automations (not in use)

[`home-assistant/`](home-assistant/) holds water automations and a test script
exported from HA on 2026-10-17. **All of these automations are disabled except
`At_6pm_send_daily_water_report_on_whatsapp`.** They aren't what runs the
system.

Don't enable them while the Node-RED flow is active. Both would switch the pump
and the drain valve at the same time.

If you ever switch back to them, fix these first:

1. **`script.test_water_supply_90s` is broken.** It never reads `flow`, `tds`
   or `verdict`, so its report comes out blank. It also keeps the valve open
   for 100 s, while its name says 10 s.
2. **Some entity IDs no longer match behaviour.** For example,
   `automation.every_hour_at_02min_if_tank_below_90_then_turn_pump_on` runs
   every 15 min below **80%**.
3. **Four automations target the pump by `device_id`.** Switch them to
   `entity_id: switch.water_motor_pump`.

## Failsafe

If Home Assistant or Node-RED is down while the pump runs, nothing turns it off.
The TP-Link plug has its own auto-off (`switch.water_motor_pump_auto_off_enabled`).
It's currently **off**, with `number.water_motor_pump_turn_off_in` set to 120.
Turning it on adds a failsafe that doesn't depend on HA.

## Files

```
node-red/README.md                                how to export the v2 flow
home-assistant/automations/water_automations.yaml disabled HA automations (reference only)
home-assistant/scripts/test_water_supply.yaml     HA test script (reference only)
esphome/README.md                                 v2 board configs (not committed yet)
```

`rest_command.send_water_alert_whatsapp` (Green API) isn't included because
it contains the API token.
