# v2 ESPHome configs: not committed yet

The v2 boards run newer firmware than [v1](../../v1/esphome/). Their YAML
lives only in the ESPHome add-on and hasn't been copied here.

These entities show what each board needs to expose:

| Board | Entity | Notes |
|---|---|---|
| `esp32-motor` | `sensor.esp32_motor_tds_sensor_ppm` | Gravity TDS, same as v1 |
| | `sensor.esp32_motor_water_flow_rate` | Flow meter in L/min (the `pulse_counter` that is commented out in v1) |
| | `switch.esp32_motor_drain_valve_switch` | Drain valve |
| | `switch.esp32_motor_back_door_lock` | Not part of the water system |
| `esp32-tank` | `sensor.esp32_tank_water_level` | Tank level in %. Replaces the two v1 float sensors |

To add them:

1. Open the ESPHome add-on and choose **Edit** on each device.
2. Copy the YAML into `motor.yaml` and `tank.yaml` in this folder.
3. Before committing, replace every password and key with `!secret …`, as the
   v1 files do. The root `.gitignore` already excludes `secrets.yaml`.
