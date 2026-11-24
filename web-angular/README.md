# PedalPass Admin Portal — Angular

The PedalPass admin portal rebuilt in **Angular 22** for the Professional Elective 2 finals project.
It manages DYCI's campus bikes: the bike list (add, view, edit, remove, search), each bike's history and
QR code, riders' problem reports, identity approvals and the activity log. It talks to the same Supabase
database as the PedalPass mobile app.

> The older React version of the portal is in `../web` and keeps working; this Angular app replaces it.

## Run it

Needs Node.js LTS. In a terminal:

```
cd web-angular
npm install
copy src\environments\environment.example.ts src\environments\environment.ts
```

Open `src/environments/environment.ts` and fill in the Supabase **Project URL** and **Publishable key**
(Supabase → Connect, and Project Settings → API Keys). Then:

```
npm start
```

Open http://localhost:4200 and sign in with an **admin** account (see `../docs/DOCUMENTATION.md` → Admin
accounts). The database must have migrations up to `011_remove_bike.sql`.

Production build: `npm run build` → upload `dist/web-angular/browser`.

## The API (backend)

Supabase exposes every database table as a REST API. The app calls it with Angular's `HttpClient`
(`src/app/core/supabase-api.service.ts`); the auth interceptor adds the API key and the admin's token.

| Data | Endpoint | Methods used |
| --- | --- | --- |
| Sign in / renew session | `/auth/v1/token?grant_type=password` / `refresh_token` | POST |
| Bikes | `/rest/v1/bikes` | GET (list, one bike), POST (add), PATCH (edit, make available) |
| Remove a bike | `/rest/v1/rpc/remove_bike` | POST — deletes a never-used bike, retires one with history |
| QR codes | `/rest/v1/rpc/bike_qr_codes`, `/rest/v1/rpc/regenerate_bike_qr` | POST |
| Reports | `/rest/v1/work_orders` | GET, PATCH (change step, mark fixed) |
| Rides | `/rest/v1/rides?select=*,profiles(name,student_id)` | GET |
| Riders | `/rest/v1/profiles` | GET |
| Approve / reject | `/rest/v1/rpc/review_verification` | POST |
| ID photos | `/storage/v1/object/sign/verification/<id>/id.jpg` | POST (10-minute link), DELETE |
| Activity log | `/rest/v1/activity_log` | GET |

Example — add a bike:

```
POST /rest/v1/bikes
Prefer: return=representation
{ "id": "BP-011", "model": "DYCI Campus Cruiser", "bay": "Bay 11", "node_id": "PP-LOCK-011",
  "battery": 100, "station": "Covered Court Hub", "status": "available" }
→ 201 [ { "id": "BP-011", ..., "retired_at": null, "updated_at": "2026-11-10T05:00:00Z" } ]
```

Every change is saved in the database, so it is still there after refreshing the page (persistence).

## Where each required topic is used

| Requirement | Where |
| --- | --- |
| 1. Components (≥ 4) | `Login`, `Shell`, `DashboardPage`, `BikesPage`, `BikeRow`, `BikeForm`, `RemoveBikeDialog`, `BikeDetailPage`, `ReportsPage`, `MarkFixedDialog`, `ApprovalsPage`, `ActivityPage`, `StatusBadge`, `QrImage`, `Toasts` |
| 2. Data binding | Interpolation `{{ bike().id }}` (everywhere) · property `[disabled]`, `[src]`, `[class.invalid]` · event `(click)`, `(ngSubmit)`, `(change)` · two-way `[(ngModel)]` on the search boxes and filters (`bikes.html`, `reports.html`, `activity.html`, `remove-bike-dialog.ts`) |
| 3. Control flow | `@if` loading / error / empty states, `@for` lists with `@empty` (`bikes.html`, `reports.html`, `bike-detail.html`), `@switch` ride results and toast icons (`bike-detail.html`, `toasts.ts`) |
| 4. Services + dependency injection | `SupabaseApi`, `AuthService`, `BikesService`, `ReportsService`, `RidersService`, `ActivityService`, `ToastService` — injected with `inject()` |
| 5. HTTP integration (CRUD) | Bikes: create `add()`, read `list()`/`get()`, update `update()`, delete `remove()` in `bikes.service.ts` |
| 6. Observables | Every API call returns an `Observable`; pages `subscribe({ next, error })`; `forkJoin` loads several at once (`dashboard.ts`, `bike-detail.ts`); `switchMap` in the interceptor |
| 7. User feedback | Spinners while loading, toasts on success/failure, form validation messages, empty states, "Try again" on API errors |
| 8. Search / filtering | Bikes: search + status filter · Reports: Open/Fixed/All, priority, search · Activity: dates, bike, search |
| 9. Persistence | All data is stored in Supabase; the admin's session is kept in `localStorage` |
| 10. Original styling | `src/styles.css` and the component `.css` files — no CSS framework; responsive sidebar for small screens |
| Also used | Router with lazy-loaded pages, route guard, route parameter as input (`/bikes/:id`), HTTP interceptor, reactive forms with custom validator, custom pipe (`reportStep`), signals and `computed()` |

## Explored feature: Parent–Child Communication

**What:** passing data from a parent component to a child with `input()`, and sending events from the
child back to the parent with `output()`.

**Why it fits PedalPass:** the Bikes page has many bikes and several dialogs. Each bike row and each dialog
is a small child component that only shows things and reports clicks; the parent `BikesPage` owns the data
and makes every API call. The children stay simple and reusable, and all decisions live in one place.

**How it works here:**

| Child | Gets from parent (`input`) | Sends to parent (`output`) |
| --- | --- | --- |
| `BikeRow` (`pages/bikes/bike-row.ts`) | `bike` | `history` (bike code), `edit` (bike), `remove` (bike) |
| `BikeForm` (`pages/bikes/bike-form.ts`) | `bike` (null = add), `takenCodes`, `suggestedCode`, `saving` | `saved` (checked values), `cancelled` |
| `RemoveBikeDialog` (`pages/bikes/remove-bike-dialog.ts`) | `bike`, `busy` | `confirmed` (bike), `cancelled` |
| `MarkFixedDialog` (`pages/reports/mark-fixed-dialog.ts`) | `report`, `busy` | `fixed` ({ fixedBy, notes }), `cancelled` |
| `StatusBadge`, `QrImage` (`shared/`) | `bike` / `payload` | — |

In the template the parent passes data in with `[bike]="bike"` and listens with `(remove)="removing.set($event)"`
(`bikes.html`). Example flow: the admin clicks **Remove** in a row → `BikeRow` emits `remove` → `BikesPage`
opens `RemoveBikeDialog` → the admin types the code → the dialog emits `confirmed` → `BikesPage` calls
`BikesService.remove()` and updates the list.

**Sources to cite:** angular.dev — Components › Inputs (https://angular.dev/guide/components/inputs) and
Outputs (https://angular.dev/guide/components/outputs).

## Test cases to run (for the testing results section)

| # | Test | Expected |
| --- | --- | --- |
| 1 | Sign in with a wrong password | "Wrong email or password." |
| 2 | Sign in with a student account | "This is not an admin account…" |
| 3 | Add bike BP-011 | Toast "BP-011 added", QR code shown, bike in the list |
| 4 | Add a bike with code `BIKE11` | "Use the form BP-001…" under the field; nothing saved |
| 5 | Add a bike with an existing code | "This code is already used by another bike." |
| 6 | Edit a bike's bay and battery, then refresh the page | Changes are still there |
| 7 | Search "BP-00" and filter by Unavailable | Only matching bikes show; "No bike matches…" when none |
| 8 | Remove a never-used bike (type its code) | "…was never used, so it was deleted." |
| 9 | Remove a bike with rides | "…removed. Its QR code no longer works…"; history kept |
| 10 | Change a report to Sent to maintenance, then Mark as fixed | Badge shows Fixed; bike becomes Available |
| 11 | Turn off Wi-Fi and open Bikes | "Could not load the bikes…" with Try again |
| 12 | Regenerate a bike's QR | New code shown; version goes up by 1 |

## Disclosure

Parts of this code were written with AI assistance (Claude) and reviewed by the group. Every member should
be able to explain the files above before the defense.
