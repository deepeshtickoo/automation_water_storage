# Grafana dashboard

`water-system.json` is a Grafana dashboard for the water supply storage solution. It reads Home Assistant's sensor and switch states from Prometheus (Home Assistant's `prometheus:` integration, scraped every 30 s).

| Row | Panels |
|---|---|
| Now | Tank level gauge, pump and drain valve state, pump power, mains voltage, flow, TDS, pump run time and tank change over the last 24 hours |
| History | Tank level, pump power, flow and TDS over time, and a pump / drain valve timeline |

## Stack

Prometheus, node-exporter, Grafana, Loki and Mosquitto run as one Docker Compose app on TrueNAS SCALE, next to the Home Assistant VM, so monitoring keeps working while Home Assistant restarts.

```
ESP32 sensors -> Home Assistant -> /api/prometheus -> Prometheus -> Grafana
TrueNAS host  -> node-exporter                    -> Prometheus -> Grafana
```

## Import

Grafana: Dashboards → New → Import → upload `water-system.json` → pick your Prometheus data source.

Queries match sensors by entity ID (for example `sensor.esp32_tank_water_level`), so change those to your own entities.
