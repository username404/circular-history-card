# circular_history_card
A 24-hour polar history card for Home Assistant sensors.

![Вигляд картки](Screenshot%202026-08-04%20160645.png)

# Circular History Card for Home Assistant

A 24-hour polar clock for your sensor history — see the daily rhythm at a glance.

Most history graphs are flat timelines that get harder to read as more days are added. This card wraps sensor history into a 24-hour dial, so each day occupies the same clock position. It makes daily patterns easy to compare: when values rise, when they drop, and how today differs from previous days.

## Features

- Polar (radial) chart: midnight at the top, time runs clockwise.
- Overlay several recent days on one dial.
- Newer days are brighter; older days fade automatically.
- Loads history directly through Home Assistant.
- Refreshes automatically on your chosen schedule.
- Works with numeric sensors: temperature, humidity, power, pressure, air quality, battery level, and more.
- One JavaScript file, no dependencies and no build step.

## Installation

### HACS (Recommended)

1. Open HACS in your Home Assistant.
2. Click the three dots in the top right corner and select **Custom repositories**.
3. Add your GitHub repository URL, select category **Lovelace**, and click **Add**.
4. Find **Circular History Card** in HACS and click **Download**.
*(HACS will automatically add the resource for you).*

### Manual

1. Copy `circular-history-card.js` to your `/config/www/` folder.
2. Go to **Settings → Dashboards → Resources** and add:
   `/local/circular-history-card.js` as a **JavaScript Module**.
3. Hard-refresh your browser.

## Configuration

```yaml
type: custom:circular-history-card
entity: sensor.esphome_web_c00230_temperature_aht20
days: 3
title: Temperature
color: "#3fa9f5"
refresh_minutes: 5
```

| Option | Default | Description |
| --- | --- | --- |
| `entity` | — | Required numeric entity. |
| `days` | `3` | Recent days to overlay. |
| `title` | Entity name | Card title. |
| `color` | `#3fa9f5` | Chart colour. |
| `refresh_minutes` | `5` | History refresh interval. |
| `height` | `340` | Chart height in pixels. |

## Support

Please open an issue with your Home Assistant version, card configuration, and browser-console error if available.
