# AMS Filament Tracker

A lightweight, mobile-first PWA for tracking how much filament is left in your 3D printers and AMS systems.

Built specifically for real-world multi-printer setups where constantly walking between printers to check spool weight gets annoying fast.

Instead of tracking colors, materials, or slicer data, this app focuses on the one thing the slicer usually doesn't know reliably:

> How much filament is actually left on the spool.

---

## Designed For

* Bambu Lab AMS systems
* AMS Lite systems
* Single-spool printers
* Fast weight updates from your phone
* Offline/local-first usage

---

# Features

* Mobile-first responsive interface
* Installable PWA (works like a native app)
* Works fully offline
* Local-first design using browser storage
* AMS / AMS Lite / Single spool support
* Track filament by actual spool weight
* Custom spool tare weights
* Add/Subtract filament mode for quick print estimation updates
* Low filament warnings
* JSON backup/export system
* Import/restore support
* Printer sorting
* Spool type sorting
* Timestamp tracking for last updates

---

# Why This Exists

Most filament trackers focus on:

* inventory management
* color databases
* material libraries
* purchase tracking

This app focuses on something much simpler and more useful during daily printing:

> "Do I have enough filament left to start this print?"

The slicer already knows:

* material
* color
* AMS slot mapping

What it usually does **not** know is:

* how much filament physically remains on the spool

This tool fills that gap.

---

# Supported Printer Modes

## AMS

Standard 4-slot layout:

```text
1 — 2 — 3 — 4
```

Used by:

* X1 series
* P1 series
* H2D series

---

## AMS Lite

2×2 layout matching the physical AMS Lite arrangement:

```text
1 4
2 3
```

Used by:

* A1
* A1 Mini

---

## Single Spool

For printers without AMS systems.

---

# How It Works

## Weigh Spool Mode

1. Put the spool on a scale
2. Enter total weight
3. Select spool type
4. App subtracts spool tare weight automatically

### Example

```text
Total spool weight: 523g
Empty spool weight: 165g
Remaining filament: 358g
```

---

## Add / Subtract Mode

Quickly adjust filament amounts after sending a print without re-weighing the spool.

### Example

* Print uses 84g
* Subtract 84g from the slot
* Updated value saved instantly

Useful when:

* your printers are in another room
* upstairs/downstairs
* garage/workshop setups
* remote monitoring before a print

---

# Low Filament Warnings

Slots automatically highlight when filament drops below the low filament threshold.

Current default threshold:

```text
100g
```

---

# Data Storage

The app currently stores all data locally using browser localStorage.

No:

* accounts
* cloud sync
* subscriptions
* external services

Your data stays on your device.

---

# Backup System

The app includes built-in JSON export/import support.

## Export

Downloads:

```text
filament-tracker.json
```

## Import

Restore a previous backup at any time.

---

# PWA Support

The app supports:

* Add to Home Screen
* Offline usage
* Mobile app-like behavior
* Cached assets via service worker

Works well on:

* Android
* iPhone
* tablets
* desktop browsers

---

# Tech Stack

* HTML
* CSS
* Vanilla JavaScript
* localStorage
* Service Workers
* Progressive Web App (PWA)

No frameworks required.

---

# Project Goals

This project intentionally avoids feature bloat.

The goal is:

* fast updates
* minimal taps
* simple workflow
* reliable offline usage
* practical daily utility

---

# Current Version

```text
v1.6.0
```

---

# Future Ideas

Potential future additions may include:

* optional local network sync
* lightweight LAN syncing between devices
* printer grouping by location
* improved quick-adjust workflows

The focus will remain on keeping the app lightweight and practical.

---

# License

MIT License
