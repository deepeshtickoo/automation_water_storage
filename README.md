# Water Supply & Storage Automation with ESP32, Node-RED, and HAOS

This project automates the management of household water supply and storage tanks using **ESP32 microcontrollers**, **ESPHome**, **Home Assistant OS (HAOS)**, and **Node-RED**.  
It runs on a dedicated homelab server powered by **TrueNAS Scale**.

The system controls a water pump based on water quality (TDS levels) and tank water level, while providing real-time monitoring, alerts, and a web dashboard.

---

## ✨ Features
- Automated water pump control using relay module
- TDS monitoring (95–195 ppm) to check water quality & availability
- Tank full detection using XKC-Y25V moisture sensor
- Real-time Node-RED dashboard with pump status, water quality, and tank level
- Notifications/alerts when:
  - Water supply starts
  - Pump turns on
  - Pump turns off
- Manual pump control via dashboard
- Runs on a dedicated homelab server (TrueNAS Scale with HAOS)

---

## 🛠️ System Architecture
[ESP32 (Pump Side)] ---- Relay + TDS Sensor
|
| WiFi (ESPHome)
|
[ESP32 (Tank Side)] ---- XKC-Y25V Sensor
|
| WiFi (ESPHome)
v
[HAOS on TrueNAS Scale] --- Node-RED --- Dashboard + Alerts

*(Insert architecture diagram here: `docs/system_architecture.png`)*

---

## 📡 Hardware Setup
- **ESP32 #1 (Pump side)**  
  - Relay module (controls pump)  
  - Gravity TDS sensor (monitors water quality/availability)  

- **ESP32 #2 (Tank side)**  
  - XKC-Y25V moisture sensor (placed at tank’s 100% level, detects when full)  

---

## ⚙️ Automation Logic
1. When TDS is **between 95–195 ppm**, the pump starts.  
2. Pump stays on until either:  
   - TDS goes out of range, or  
   - The tank full sensor is triggered.  
3. Notifications are sent when:  
   - Water supply starts  
   - Pump is switched on  
   - Pump is switched off  

*(Insert flow chart here: `flow_chart.jpg`)*

---

## 🚀 Installation & Setup

### 1. Install HAOS on TrueNAS Scale
- Deploy Home Assistant OS as a VM on your TrueNAS Scale server.  
- Ensure Node-RED add-on is installed and accessible.

### 2. Configure ESP32 Devices with ESPHome CLI
```bash
# Install ESPHome CLI if not already
pip install esphome

# Generate and upload configs for pump-side ESP32
esphome run pump_esp32.yaml

# Generate and upload configs for tank-side ESP32
esphome run tank_esp32.yaml
