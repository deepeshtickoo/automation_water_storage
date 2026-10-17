# Water Supply & Storage Automation

This project automates filling the household water tanks from the municipal
supply. It pumps only when water is actually flowing and its TDS is in a safe
range, and stops when the tank is full. It runs on ESP32 boards with ESPHome,
Home Assistant OS and Node-RED, in a VM on a TrueNAS Scale homelab server.

## Versions

Both versions use a Node-RED flow for the logic. The hardware is what changed.

| | Status | Hardware |
|---|---|---|
| [**v2**](v2/README.md) | **Current** | One smart-plug pump, tank level %, drain valve, flow meter + TDS |
| [v1](v1/README.md) | Archived | Two relay motors, two full / not-full tank sensors, TDS only |

## Repository layout

```
.
├── v1/
│   ├── README.md                  hardware and Node-RED logic
│   ├── esphome/
│   │   ├── motor.yaml             pump-side ESP32 (2 relays + TDS)
│   │   ├── tank.yaml              tank-side ESP32 (2 level sensors)
│   │   └── secrets.yaml.example
│   └── node-red/
│       ├── flow_chart.jpg         screenshot of the flow
│       └── README.md              how to export the flow JSON
└── v2/
    ├── README.md                  hardware, entities, failsafe
    ├── node-red/README.md         flow export goes here (to be added)
    ├── esphome/README.md          board configs (to be added)
    └── home-assistant/            disabled HA automations, reference only
```

## Secrets

ESPHome configs read every password and key from `secrets.yaml`, which
`.gitignore` excludes. Start from `secrets.yaml.example`.

> **Earlier commits in this repo contain the real Wi-Fi and hotspot passwords.**
> Removing them from the current files doesn't remove them from git history.
> Change those passwords, and any other account that uses the same password.
