# PedalPass — Campus Bicycle Access System & ESP32 Smart Bike Lock (DYCI)

> **🚀 Team VS Code & PlatformIO Setup Guide:** **[TEAM_VSCODE_SETUP_GUIDE.md](TEAM_VSCODE_SETUP_GUIDE.md)** — Complete step-by-step guide to open **`pedalpass.code-workspace`**, run **`setup-project.ps1`** / **`start-all.bat`**, and build/upload the **ESP32 Smart Bike Lock firmware (`firmware/`)** in VS Code with PlatformIO!
>
> **Full system documentation:** [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) — setup, running the apps, admin accounts, how each page works, troubleshooting.

This repository includes the full software and hardware stack:

| Folder / File | Who uses it | Built with | How to open |
|---|---|---|---|
| `firmware/` | **ESP32 Smart Bike Lock PCB**: 4-state lock controller, dual servos (`MG996R` + `SG90`), 3 status LEDs (`GPIO 21/22/23`), piezo buzzer (`GPIO 19`), `Bike01_Lock` SoftAP (`192.168.4.1`) | PlatformIO (`esp32dev`, Arduino C++) | Open **`pedalpass.code-workspace`** in VS Code (PlatformIO IDE) |
| `mobile/` | **Students & faculty**: scan/upload QR, unlock bike, mid-ride temporary park lock, return, history, report issue | Expo (React Native + Expo Web), SDK 58 | **[http://localhost:8081](http://localhost:8081)** in Browser or **Expo Go** on your phone |
| `web/` | **Admins (React)**: identity approvals, fleet, QR codes, SOS alerts, repairs, parts | React + Vite + Tailwind | **[http://localhost:3000](http://localhost:3000)** |
| `web-angular/` | **Admins (Angular 22)**: full admin portal in Angular 22 | Angular 22 | **[http://localhost:4200](http://localhost:4200)** |
| `esp32-bridge.mjs` | **Wi-Fi Hardware Bridge**: forwards lock commands from `mobile/` to the physical ESP32 (`http://192.168.4.1`) with automatic simulated fallback | Node.js HTTP Bridge | `http://localhost:3001` (started by `start-all.bat`) |
| `test-qr-codes/` | Legacy sample QR codes (Note: since Migration 010, download live signed QR codes from the Admin Portal's **QR Codes** page) | — | Admin Portal $\rightarrow$ **QR Codes** $\rightarrow$ Download PNG |

Both apps run on a **Supabase** database (live data, no sample data in the code). Set it up first: see "Next steps" below.

---

## Requirements (install once)

1. **Node.js LTS** from https://nodejs.org (check with `node -v`)
2. **VS Code** + the **Expo Tools** extension (optional, for autocomplete/debugging)
3. **Expo Go** from the Play Store on your Android phone

---

## 1) Run the student mobile app (Expo Go)

Open a terminal in VS Code:

```powershell
cd mobile
npm install
npx expo start
```

- A QR code appears in the terminal. Open **Expo Go** on your phone → **Scan QR code**.
- Phone and laptop must be on the **same Wi-Fi**.
- If it won't connect (school Wi-Fi often blocks it), use:
  `npx expo start --tunnel`
- After editing code, save the file; the app reloads on your phone. Press `r` in the terminal to reload manually.

**Try the flow:** Sign In → Scan (allow camera) → scan `test-qr-codes/BP-001.png` from your laptop screen
(or tap a demo bike button / "Enter Code") → Unlock → Active Ride → End Ride → History.

> If Expo Go says the project's SDK is not supported, update Expo Go from the Play Store.
> This project uses **Expo SDK 58**.

## 2) Run the staff web portal

In a second terminal:

```powershell
cd web
npm install
npm run dev
```

Open **http://localhost:3000** and sign in with an **admin** account
(see "Admin accounts" below).

Build for hosting: `npm run build` → upload the `web/dist` folder (Firebase Hosting, Netlify, Vercel).

---

## Next steps (in order)

1. **Supabase (database + login)** — one Supabase project for both apps. The client library is already installed.
   1. Create a free project at https://supabase.com (region: Singapore is closest).
   2. Dashboard → **SQL Editor** → New query → paste all of `supabase/schema.sql` → **Run**.
      This creates the tables (`profiles`, `stations`, `bikes`, `rides`, `work_orders`, `inventory`, `alerts`),
      the security rules, and the sample bikes/tickets/parts.
      Then run `supabase/migrations/002_identity_verification.sql` the same way. It allows any email to sign up
      and adds the identity check: riders upload their school ID, COR and a selfie (private storage), and
      admins approve them on the web portal's **Identity Approvals** page. Only approved riders can ride.
      That page runs a free, open-source AI check in the staff's browser to help them decide:
      face match between the ID photo and the selfie (Human, models in `web/public/models`) and the
      student number read from the ID/COR (Tesseract.js). Staff still make the final decision.
      Then run `supabase/migrations/003_unlock_tokens.sql`. It gives each smart lock its own secret key and
      lets the app get a signed 60-second unlock token for the rider's ride (the ESP32 checks it).
      Then run `supabase/migrations/004_privacy_and_reports.sql`. Only admins can then see riders'
      profiles and ID photos, riders can't swap photos while they are being reviewed, and the database fills in
      the details of issue reports itself (a rider's "Unsafe to ride" report only blocks a bike they rode in the last hour).
   - **Scan COR** (sign-up screen): students photograph their COR and the form fills itself in (free OCR.space text reading
     + fixed rules, no AI). Get a free key at https://ocr.space/ocrapi. It stays on the server:
     `supabase secrets set OCR_SPACE_API_KEY=...` then
     `supabase functions deploy scan-cor --no-verify-jwt` (sign-up happens before login). The photo is not saved.
      Then run `supabase/migrations/005_live_data.sql`. It removes the three made-up sample repair tickets so the
      staff portal starts with real data only. The bikes, hubs and parts in `schema.sql` are starter rows:
      edit them in Table Editor to match your real fleet and stock.
   3. Copy the **Project URL** (green **Connect** button at the top) and the **Publishable key**
      (Project Settings → API Keys, starts with `sb_publishable_`) into
      - `mobile/.env.local` (copy `mobile/.env.example`)
      - `web/.env` (copy `web/.env.example`)
   4. **Verification emails (6-digit code)** — sent from a Gmail account
      (DYCI's Microsoft 365 blocks these, so riders should sign up with a personal email):
      1. On the Gmail account: turn on 2-Step Verification, then create an App Password at
         https://myaccount.google.com/apppasswords (name it "PedalPass", copy the 16-letter password).
      2. Supabase → Authentication → Emails → **SMTP Settings** → enable custom SMTP:
         host `smtp.gmail.com`, port `587`, username = the Gmail address, password = the App Password,
         sender email = the Gmail address, sender name `PedalPass`.
      3. Supabase → Authentication → Emails → Templates → **Confirm signup**: paste
         `supabase/email-templates/confirm-signup.html` (it sends the code instead of a link).
      4. Make sure Authentication → Sign In / Providers → Email → **Confirm email** is ON
         and **Email OTP Length** is 6.
      - First emails may land in the **Spam / Junk** folder — mark them "Not spam".
      - Quick testing without email: turn **Confirm email** off; accounts work right after sign-up.
   5. **Roles: User and Admin.** Run `supabase/migrations/005`, `006` and `007_user_and_admin_roles.sql` too.
      Students and faculty sign up in the app as **users**. Admin accounts (web portal): create them in
      Authentication → Users → **Add user** (tick "Auto confirm"),
      then in the SQL Editor run: `update profiles set role = 'admin', verification_status = 'approved', is_verified = true where email = '...';`
   6. **Automation and history.** Run `supabase/migrations/009_under_inspection_status.sql`, then
      `010_automation_and_history.sql` (in that order, as two separate runs). Bike statuses then update themselves
      (an issue report puts a bike **Under Inspection**, resolving its last ticket makes it available again), bikes
      under 20% lock battery can't be borrowed, and every ride, report, repair, swap and part used goes into the activity log.
      **QR codes change:** each bike's QR now carries a secret code, so the old `test-qr-codes/*.png` stop working.
      Print new ones from the web portal's **QR Codes** page. **Regenerate** there makes a bike's old QR stop working.
   7. **Remove bikes + low battery rule.** Run `supabase/migrations/011_remove_bike.sql`. The web portal's Bikes page
      can then remove a bike (a never-used bike is deleted; one with rides or reports is retired so its history stays,
      and its QR code stops working). Bikes at **20% lock battery or lower** show as **Unavailable** and can't be borrowed.
      Both apps hide removed bikes, so run 011 before using the updated apps.
   - Free projects pause after ~1 week with no activity — open the dashboard before a demo.
   - Remaining work: replace the `// TODO:` comments in the code (search for `TODO` in VS Code).
2. **Real smart lock (Bluetooth)** — Expo Go cannot use Bluetooth. When the ESP32 lock is ready:
   ```powershell
   cd mobile
   npx expo install expo-dev-client react-native-ble-plx
   npx expo run:android      # needs Android Studio, or use: npx eas-cli build --profile development
   ```
   Then replace the fake functions in `mobile/src/services/lockService.ts`. No screen changes needed.
3. **Usability testing** with students (SUS / ISO 25010 questionnaire) for your study.

## Project structure

```
mobile/
  App.tsx                     screen switching + app state (rides, bikes)
  src/screens/                Login, Register, Home, Scan, ActiveRide, RideHistory, ReportIssue
  src/components/             UI kit (ui.tsx), Icon, PedalPassLogo, BottomNavBar
  src/services/lockService.ts SIMULATED smart lock (replace with BLE later)
  src/data/mockData.ts        sample users, bikes, rides
  src/theme.ts                DYCI colors
web/
  src/App.tsx                 admin portal layout (sidebar, pages)
  src/components/             Login, Security, Maintenance, Work Order, Admin, Inventory, Report
  src/data/mockData.ts        sample data
```
