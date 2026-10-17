# Water Supply & Storage Automation

This project automates filling the household water tanks from the municipal
supply. It pumps only when water is actually flowing and its TDS is in a safe
range, and stops when the tank is full. It runs on ESP32 boards with ESPHome and
Home Assistant OS, in a VM on a TrueNAS Scale homelab server.

## Versions

| | Status | Summary |
|---|---|---|
| [**v2: Home Assistant**](v2-home-assistant/README.md) | **Current** | One smart-plug pump, tank level %, drain-valve flow + TDS check, WhatsApp alerts. All logic in HA automations. |
| [v1: Node-RED](v1-nodered/README.md) | Archived | Two relay motors, two full / not-full tank sensors, TDS-only check, Node-RED flow. |

## Repository layout

```
.
├── v1-nodered/
│   ├── README.md                  v1 hardware and Node-RED logic
│   ├── esphome/
│   │   ├── motor.yaml             pump-side ESP32 (2 relays + TDS)
│   │   ├── tank.yaml              tank-side ESP32 (2 level sensors)
│   │   └── secrets.yaml.example
│   └── node-red/
│       ├── flow_chart.jpg         screenshot of the flow
│       └── README.md              how to export the flow JSON
└── v2-home-assistant/
    ├── README.md                  v2 logic, live state, known issues
    ├── automations/water_automations.yaml
    ├── scripts/test_water_supply.yaml
    └── esphome/README.md          v2 board configs (to be added)
```

## Secrets

ESPHome configs read every password and key from `secrets.yaml`, which
`.gitignore` excludes. Start from `secrets.yaml.example`.

> **Earlier commits in this repo contain the real Wi-Fi and hotspot passwords.**
> Removing them from the current files doesn't remove them from git history.
> Change the Wi-Fi password, and the fallback hotspot password, on the router
> and on every device.
