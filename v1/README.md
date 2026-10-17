# v1: Two relay motors, float sensors, Node-RED

> **Archived.** This is the first version of the system, as of September 2025.
> It has been replaced by [v2](../v2/README.md). It is kept here
> for reference.

Two ESP32 boards running ESPHome report to Home Assistant OS. HAOS runs as a VM
on TrueNAS Scale. A Node-RED flow in the HAOS add-on decides when the two
motors run.

## Hardware

| Board | File | Connected | Pin |
|---|---|---|---|
| `esp32-motor` (pump side) | [`esphome/motor.yaml`](esphome/motor.yaml) | Relay → Ground Floor Motor | GPIO25 |
| | | Relay → Top Floor Motor | GPIO26 |
| | | Gravity TDS probe on the supply line | GPIO35 (ADC) |
| `esp32-tank` (tank side) | [`esphome/tank.yaml`](esphome/tank.yaml) | XKC-Y25V level sensor, "Tank 0 Sensor" | GPIO27 |
| | | XKC-Y25V level sensor, "Tank 1&2" | GPIO26 |

Each XKC-Y25V sits at the 100% mark of its tank and reads **on** when the tank
is full.

> **Unconfirmed:** the flow calls the sensors "top floor tank" and "ground floor
> tank". The ESPHome names are "Tank 0 Sensor" and "Tank 1&2". Which one is which
> wasn't recorded. The entity names have been kept as-is so the flow's entity IDs
> don't change.

## Automation logic (Node-RED)

This section is read from [`node-red/flow_chart.jpg`](node-red/flow_chart.jpg).
The flow's JSON was never committed. See [`node-red/README.md`](node-red/README.md).

Every new TDS reading (every 10 s) goes through these bands:

| TDS (ppm) | Meaning | What the flow does |
|---|---|---|
| below 58.5 | Probe is dry: no supply | Both motors off |
| 58.5 – 95 | Supply uncertain | Every 15 min at most: top floor motor on for 5 s, then off (a priming test) |
| 95 – 244 | Good supply | Per-tank level control (below) |
| 244 and above | Water quality out of range | Both motors off. After 30 min, top floor motor on for 60 s to retest |

Level control while TDS is between 95 and 244:

- **Top floor:** the tank sensor has been off (not full) for 45 min → top floor
  motor on. Sensor on (full) → top floor motor off.
- **Ground floor:** the tank sensor has been off for **30 h** → ground floor
  motor on. Sensor on → ground floor motor off.
  *(The node label says 30 hrs. Confirm whether 30 min was meant.)*

The old README said the pump ran at 95–195 ppm. The flow actually uses 95–244.

## On-device failsafes (added to the YAML)

These run on `esp32-motor` itself, so they work even if HA or Node-RED is down:

- **Max runtime:** each motor switches itself off after `max_motor_runtime`
  (default 90 min). Tune it in `substitutions:`.
- **Dry-run cutoff:** both motors turn off when TDS drops below 58.5 ppm. This
  is the same threshold the flow uses.
- `restore_mode: ALWAYS_OFF` means both motors start **off** after a reboot or
  power cut.

The tank sensors use `delayed_on`/`delayed_off` filters, so ripples don't reset
the "off for N min" timers.

## Flashing

```bash
pip install esphome
cd esphome
cp secrets.yaml.example secrets.yaml   # fill in real values; git ignores this file
esphome run motor.yaml
esphome run tank.yaml
```

After adding an API encryption key, Home Assistant asks for the key the next
time each device connects. Paste the same value you put in `secrets.yaml`.

## Not in v1

The previous README listed several features that this flow doesn't have:

- WhatsApp or push notifications
- A Node-RED dashboard (there are no dashboard nodes in the flow)

Notifications arrived in v2.
