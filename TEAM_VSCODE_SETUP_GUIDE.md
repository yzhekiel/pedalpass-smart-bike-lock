# PedalPass + ESP32 Smart Bike Lock — Complete VS Code & PlatformIO Setup Guide

This guide walks any team member through setting up the **entire Smart Bike Lock + PedalPass system** in **Visual Studio Code (VS Code)** on a new Windows laptop/PC—including the **PlatformIO ESP32 Firmware (`firmware/`)**, the **Student/Faculty Mobile App (`mobile/`)**, the **Admin Web Portals (`web/` and `web-angular/`)**, and the **ESP32 Hardware Wi-Fi Bridge (`esp32-bridge.mjs`)**.

---

## 1. Repository Folder Structure

```text
pedalpass/
├── pedalpass.code-workspace      <-- DOUBLE-CLICK THIS to open the full multi-root project in VS Code!
├── setup-project.ps1             <-- 1-click PowerShell setup script (creates .env files & runs npm install)
├── start-all.bat                 <-- 1-click launcher (starts Mobile, Web, Angular & ESP32 Bridge)
├── esp32-bridge.mjs              <-- Connects the PedalPass App (Port 3001) to the physical ESP32 (192.168.4.1)
├── TEAM_VSCODE_SETUP_GUIDE.md    <-- This step-by-step setup guide
├── firmware/                     <-- PlatformIO ESP32 Smart Bike Lock Firmware Project
│   ├── platformio.ini            <-- PlatformIO configuration (esp32dev + ESP32Servo library)
│   ├── src/main.cpp              <-- Main ESP32 C++ firmware (SoftAP, 4-state lock, servos, LEDs, buzzer)
│   ├── smart_bike_lock_firmware/ <-- Arduino IDE compatible .ino copy
│   └── hardware_docs/            <-- Wiring schematics, 2-layer FR4 PCB layout & I LOCK IT PRO blueprint
├── mobile/                       <-- Student & Faculty App (Expo SDK 58 / React Native + Expo Web)
├── web/                          <-- Admin Web Portal (React + Vite + Tailwind — Port 3000)
├── web-angular/                  <-- Admin Web Portal (Angular 22 — Port 4200)
└── supabase/                     <-- Database schema & migrations 002–011 (already live on Supabase!)
```

---

## 2. One-Time Prerequisites to Install on Your PC

1. **Node.js LTS (v22+):** Download and install from [https://nodejs.org](https://nodejs.org) (verify in terminal with `node -v`).
2. **Git for Windows:** Download from [https://git-scm.com](https://git-scm.com).
3. **Visual Studio Code (VS Code):** Download from [https://code.visualstudio.com](https://code.visualstudio.com).
4. **ESP32 USB-to-UART Driver (Required to flash the ESP32 over USB):**
   - Most 38-pin ESP32 DevKit boards use the **Silicon Labs CP210x** or **CH340** USB driver. If Windows Device Manager does not show a `COM` port under **Ports (COM & LPT)** when you plug in the ESP32 via Micro-USB, install the [CP210x Universal Windows Driver](https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers).

---

## 3. Cloning & Opening the Project in VS Code

1. Open a terminal (PowerShell or Command Prompt) and clone the repository:
   ```powershell
   git clone https://github.com/yzhekiel/pedalpass-smart-bike-lock.git
   cd pedalpass-smart-bike-lock
   ```
2. **Open via the Workspace File (Important for PlatformIO!):**
   - Inside the `pedalpass` folder, double-click **`pedalpass.code-workspace`** (or in VS Code go to **File $\rightarrow$ Open Workspace from File...** and select `pedalpass.code-workspace`).
   - Why? Opening `pedalpass.code-workspace` mounts `firmware/` as its own root folder inside VS Code so the **PlatformIO IDE** extension automatically detects `platformio.ini` and displays the **`✓` (Build)** and **`→` (Upload)** buttons in the bottom status bar!
3. **Install Recommended VS Code Extensions:**
   - When VS Code opens, a popup in the bottom-right corner will ask: *"Do you want to install the recommended extensions for this repository?"* $\rightarrow$ Click **Install**.
   - Or open the **Extensions** sidebar (`Ctrl + Shift + X`) and install:
     - **PlatformIO IDE** (`platformio.platformio-ide`) — *wait ~1–2 minutes on first install for PlatformIO to finish installing its Python core in the background, then click "Reload Now" when prompted.*
     - **C/C++** (`ms-vscode.cpptools`)
     - **Expo Tools** (`expo.vscode-expo-tools`)
     - **Angular Language Service** (`angular.ng-template`)

---

## 4. Automated Software Setup (Environment Keys + `npm install`)

The Supabase database (`https://zxhdfkcsbdsmtyfwhqej.supabase.co`) is **already fully set up in the cloud** with all 11 migrations (`schema.sql` + `002` through `011`) applied.

To automatically create your local `.env` files and install all Node packages across `web/`, `mobile/`, and `web-angular/`:

### Option A — Using VS Code's Built-in Task Menu (Recommended)
1. In VS Code, press **`Ctrl + Shift + P`** (or go to top menu **Terminal $\rightarrow$ Run Task...**).
2. Select **`1. Setup All Dependencies (npm install + env files)`**.
3. Wait ~1–2 minutes until the terminal prints `Setup Complete!`.

### Option B — Running the PowerShell Script Directly
Open a terminal in the `pedalpass` folder and run:
```powershell
powershell -ExecutionPolicy Bypass -File .\setup-project.ps1
```

*(Note: `setup-project.ps1` automatically creates `mobile/.env.local`, `web/.env`, and `web-angular/src/environments/environment.ts` with the team's live Supabase URL and Publishable Key, installs all dependencies, and patches Angular CLI's Node version check so it runs on any Node v22+ release).*

---

## 5. Setting Up & Flashing the ESP32 Firmware in VS Code (PlatformIO)

All ESP32 Smart Bike Lock firmware files are located in **`firmware/`**:
- **`firmware/platformio.ini`** — Configures `board = esp32dev`, `framework = arduino`, `monitor_speed = 115200`, and automatically downloads `madhephaestus/ESP32Servo`.
- **`firmware/src/main.cpp`** — The complete ESP32 firmware source code.

### Hardware Pinout Summary (38-Pin ESP32 on the FR4 Perfboard)

| Component | ESP32 Pin | Perfboard Header Position (Micro-USB on Right) | Behavior |
| :--- | :--- | :--- | :--- |
| **Green LED (Unlocked / Riding)** | **`GPIO 23`** | Top Row, Hole 2 (via $220\,\Omega$ resistor) | Turns **ON** when unlocked (`IN_USE_RIDING`) |
| **Yellow LED (On Park / Temp Lock)** | **`GPIO 22`** | Top Row, Hole 3 (via $220\,\Omega$ resistor) | Turns **ON** during mid-ride park (`IN_USE_TEMP_LOCKED`) |
| **Red LED (Locked / Available)** | **`GPIO 21`** | Top Row, Hole 6 (via $220\,\Omega$ resistor) | Turns **ON** when locked at station (`AVAILABLE`) |
| **Active Piezo Buzzer** | **`GPIO 19`** | Top Row, Hole 8 | Beeps on unlock/park/return + anti-theft pre-alarm |
| **SG90 Deadbolt Pin Servo** | **`GPIO 18`** | Top Row, Hole 9 | $0^\circ$ = Pin Retracted, $90^\circ$ = Pin Engaged |
| **MG996R C-Latch Shackle Servo** | **`GPIO 17`** | Top Row, Hole 11 | $0^\circ$ = C-Latch Closed, $180^\circ$ = C-Latch Open |
| **Limit Switch (`KW11-3Z`)** | **`GPIO 27`** | Bottom Row (`INPUT_PULLUP`) | Optional spoke-obstruction verification |
| **Vibration Sensor (`SW-420`)** | **`GPIO 26`** | Bottom Row (`INPUT`) | Confirms wheel stationary $\ge 3\text{s}$ before locking |
| **Logic `+5V` Power Input** | **`5V` (`VIN`)** | Bottom-Right Corner Pin (next to USB) | Powered by `MP1584EN #1` calibrated to **$5.00\text{V}$** |

> [!CAUTION]
> **Critical Hardware Safety Rules Before Flashing via USB:**
> 1. **Disconnect the 12V Battery (or unplug the ESP32 from the PCB female headers) before plugging the Micro-USB cable into your laptop** so USB $5\text{V}$ and battery buck converter $5\text{V}$ do not back-feed each other.
> 2. When plugging the ESP32 back into the 19-pin female headers on the PCB, **make sure the Micro-USB port faces the RIGHT side** (so the top row is `GND | 23 | 22 | TX | RX | 21 | GND | 19 | 18 | 5 | 17...` from left to right).

### How to Build, Upload & Monitor in VS Code

1. Plug the ESP32 into your laptop using a data-capable Micro-USB cable.
2. Look at the **blue Status Bar at the very bottom of VS Code** (added by PlatformIO IDE):
   - Click **`✓` (PlatformIO: Build)** to compile `firmware/src/main.cpp` (PlatformIO will automatically download the ESP32 toolchain and `ESP32Servo` library on the first build).
   - Click **`→` (PlatformIO: Upload)** to flash the firmware onto the ESP32 (PlatformIO auto-detects the `COM` port).
   - Click **`🔌` (PlatformIO: Serial Monitor)** to view live boot logs at `115200` baud.
3. *(Alternative)* You can also press **`Ctrl + Shift + P` $\rightarrow$ `Tasks: Run Task`** and select:
   - **`6. ESP32 Firmware: Build (PlatformIO)`**
   - **`7. ESP32 Firmware: Upload & Monitor (PlatformIO)`**

### Connecting to the ESP32's Built-In Wi-Fi Hotspot (`Bike01_Lock`)
Once flashed and powered on, the ESP32 broadcasts its Wi-Fi Access Point:
- **Wi-Fi SSID:** `Bike01_Lock`
- **Password:** `smartbike01`
- **Direct Hardware Bench Tester Portal:** [http://192.168.4.1](http://192.168.4.1) *(Open in any browser while connected to `Bike01_Lock` to manually test the `MG996R`, `SG90`, Green/Yellow/Red LEDs, and Buzzer!)*

---

## 6. Running the Complete PedalPass Software Suite

### Fastest Way: Double-Click `start-all.bat`
Double-click **`start-all.bat`** in the `pedalpass` folder (or run tasks `2`, `3`, `4`, and `5` in VS Code via **Terminal $\rightarrow$ Run Task...**). It opens 4 servers:

| Service | Local Browser URL | Purpose |
| :--- | :--- | :--- |
| **1. Student & Faculty Mobile App** | **[http://localhost:8081](http://localhost:8081)** *(or scan QR in **Expo Go**)* | Sign in as a Student/Faculty, scan or upload a Bike QR Code, inspect, unlock, temporary park lock, and return bikes. |
| **2. Admin Web Portal (React/Vite)** | **[http://localhost:3000](http://localhost:3000)** | Sign in as an Admin to manage bikes, download/print **QR Codes**, approve student IDs, and resolve maintenance reports. |
| **3. Admin Web Portal (Angular 22)** | **[http://localhost:4200](http://localhost:4200)** | Angular 22 Admin Portal connected to the same Supabase database. |
| **4. ESP32 Hardware Wi-Fi Bridge** | **[http://localhost:3001](http://localhost:3001)** | Forwards lock commands (`unlock`, `templock`, `return`, `status`) from the Mobile App to the physical ESP32 (`http://192.168.4.1`). If the ESP32 is turned off, it automatically provides a simulated fallback so you can test the apps anytime! |

---

## 7. How to Test an End-to-End Bike Unlock & Return in Your Browser

1. **Download a Valid Bike QR Code from the Admin Portal:**
   - Open **[http://localhost:3000](http://localhost:3000)** (or **[http://localhost:4200](http://localhost:4200)**) and sign in with an **Admin** account.
   - Click **QR Codes** in the left sidebar and click **Download** on **`BP-001`** (or any available bike whose battery is $> 20\%$).
   - *(Note: Do not use the old static images in `test-qr-codes/`; Migration `010` requires secret-signed `PEDALPASS:BP-001:<secret>` QR codes generated from the Admin Portal's QR Codes page).*
2. **Scan / Upload the QR Code in the Student App:**
   - Open **[http://localhost:8081](http://localhost:8081)** in your browser (or open the app in **Expo Go** on your phone) and sign in with an approved **Student/Faculty** account.
   - Click the **Scan** tab in the bottom navigation bar.
   - Either hold the QR code up to your webcam, **OR** click **"Upload QR Code Image (PNG / JPG)"** right below the camera box and select the downloaded `BP-001` QR image!
3. **Unlock, Temporary Park, and Return:**
   - Once all 5 Access Verification checks pass, click **`UNLOCK BICYCLE NOW`** $\rightarrow$ complete the pre-ride inspection checklist $\rightarrow$ click **`Looks good — Unlock`**.
   - **On the Physical ESP32 PCB:** The `SG90` retracts ($0^\circ$), the `MG996R` swings open ($180^\circ$), the `SG90` pins open ($90^\circ$), the buzzer beeps, and the **Green LED (`GPIO 23`)** turns ON!
   - **On the Active Ride Screen:**
     - Click **`Temporary Lock (Park Outside Classroom)`** to close the physical lock and turn on the **Yellow Park LED (`GPIO 22`)** while keeping your ride session active (click **`Resume Ride`** to unlock again).
     - Click **`End Ride & Lock Bicycle`** $\rightarrow$ complete the return checklist to lock the bike, turn on the **Red Locked LED (`GPIO 21`)**, and log the completed ride in Supabase!
