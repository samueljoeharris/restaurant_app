# TEST_FLOWS — Live UI audit catalog

Manual test flows for Little Scout. Use after deploy to **app.dev** (and locally during development). Fill the **Audit** table on each run.

**Theme gate (Bluebird #63):** Quicksand + Nunito fonts, paper `#FBF6EC`, sky brand `#3FA7D6`, mango accent `#FBA63C`, teardrop tier pins, no legacy forest green `#2d5a3d`.

---

## How to run

| Env | URL |
|-----|-----|
| Local | `http://localhost:5173` (API `:8080`) |
| Dev | `https://app.dev.littlescout.app` |
| Admin dev | `https://admin.dev.littlescout.app` (IAP + admin claim) |

1. Sign in with the shared dev test account — `DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD` from `.secrets/dev-test.env` (see [AGENTS.md](../AGENTS.md) § Browser / UI test plan). Canonical email: `contrib-1781961579@ttf.test`.
2. Run **P0** flows in light mode; repeat **WEB-SHELL-03** + one flow per area in dark mode.
3. Mark Audit columns: date, runner, pass/fail, notes.

---

## Entry template

```markdown
### FLOW-ID — Title
| Field | Value |
|-------|-------|
| **ID** | |
| **Surface** | web-pilot \| admin \| ios |
| **Route(s)** | |
| **Preconditions** | |
| **Priority** | P0 \| P1 \| P2 |

**Steps** — numbered

**Expected (functional)**

**Expected (theme / Bluebird)**

**Accessibility**

**Audit**
| Env | Light | Dark | Last run | Runner | Notes |
|-----|-------|------|----------|--------|-------|
| app.dev | ☐ | ☐ | | | |
```

---

## Auth & shell

### WEB-AUTH-01 — Login email/password

| Field | Value |
|-------|-------|
| **ID** | WEB-AUTH-01 |
| **Surface** | web-pilot |
| **Route(s)** | `/login` |
| **Preconditions** | Signed out |
| **Priority** | P0 |

**Steps**
1. Open `/login`.
2. Enter valid email/password; submit Sign in.
3. Confirm redirect to `/map`.

**Expected (functional)** — Session established; map loads.

**Expected (theme)** — ScoutLogo compass (sky + mango); warm paper background; Quicksand title.

**Audit** | app.dev | ☐ | ☐ | | | |

---

### WEB-AUTH-02 — Login Google OAuth

| Field | Value |
|-------|-------|
| **ID** | WEB-AUTH-02 |
| **Surface** | web-pilot |
| **Route(s)** | `/login` |
| **Priority** | P0 |

**Steps** — Continue with Google → complete OAuth → land on `/map`.

**Expected (theme)** — Google button styled; no redirect loop.

**Audit** | app.dev | ☐ | ☐ | | | |

---

### WEB-SHELL-01 — Sidebar navigation

| Field | Value |
|-------|-------|
| **ID** | WEB-SHELL-01 |
| **Surface** | web-pilot |
| **Route(s)** | `/map`, `/saved`, `/account` |
| **Priority** | P0 |

**Steps** — Click Explore, Saved, You; active tab shows sky brand highlight on cream rail.

**Expected (theme)** — ScoutLogo in sidebar; warm `bg-bg` rail.

**Audit** | app.dev | ☐ | ☐ | | | |

---

### WEB-SHELL-03 — Theme toggle

| Field | Value |
|-------|-------|
| **ID** | WEB-SHELL-03 |
| **Surface** | web-pilot |
| **Priority** | P0 |

**Steps** — Account → toggle light / dark / system; verify surfaces and text flip.

**Expected (theme)** — Dark mode readable; brand sky visible in both modes.

**Audit** | app.dev | ☐ | ☐ | | | |

---

## Explore & map

### WEB-MAP-01 — Map load + basemap

| Field | Value |
|-------|-------|
| **ID** | WEB-MAP-01 |
| **Surface** | web-pilot |
| **Route(s)** | `/map` |
| **Priority** | P0 |
| **Related** | [MAP_STYLE.md](./MAP_STYLE.md) |

**Steps**
1. Open Explore signed in.
2. Confirm map tiles load (Maps API key set).
3. If `VITE_GOOGLE_MAPS_MAP_ID` configured: ivory land, sky water, minimal POI.

**Expected (theme)** — Basemap matches Bluebird when Map ID set; pins visible without POI clutter.

**Audit** | app.dev | ☐ | n/a | | | |

---

### WEB-MAP-02 — Teardrop tier pins + legend

| Field | Value |
|-------|-------|
| **ID** | WEB-MAP-02 |
| **Surface** | web-pilot |
| **Priority** | P0 |

**Steps** — Observe pins (teardrop shape); bottom legend shows tier swatches (fast/ok/slow + ratings/notes).

**Expected (theme)** — Teardrops not circles; legend teardrop swatches match pin colors.

**Audit** | app.dev | ☐ | ☐ | | | |

---

### WEB-MAP-03 — Pin labels and tooltips

| Field | Value |
|-------|-------|
| **ID** | WEB-MAP-03 |
| **Priority** | P0 |

**Steps** — Hover/focus pin with TTF data → `Nm` label; ratings show ★; notes 💬.

**Audit** | app.dev | ☐ | ☐ | | | |

---

### WEB-MAP-04 — Cluster bubbles

| Field | Value |
|-------|-------|
| **ID** | WEB-MAP-04 |
| **Priority** | P1 |

**Steps** — Zoom out until clusters appear; bubble uses sky brand; click zooms in.

**Audit** | app.dev | ☐ | ☐ | | | |

---

### WEB-MAP-05 — Place search focus

| Field | Value |
|-------|-------|
| **ID** | WEB-MAP-05 |
| **Priority** | P0 |

**Steps** — Search restaurant; map pans; search-focus pin scales with sky glow.

**Audit** | app.dev | ☐ | ☐ | | | |

---

### WEB-MAP-08 — Locate FAB

| Field | Value |
|-------|-------|
| **ID** | WEB-MAP-08 |
| **Priority** | P1 |

**Steps** — Click locate; user dot appears; FAB active state uses brand border.

**Audit** | app.dev | ☐ | ☐ | | | |

---

## Saved & watchlist

### WEB-SAVED-01 — Saved list

| Field | Value |
|-------|-------|
| **ID** | WEB-SAVED-01 |
| **Route(s)** | `/saved` |
| **Priority** | P0 |

**Steps** — Open Saved; list or empty state; tier dots on rows.

**Expected (theme)** — Feed-style warm cards; celebratory copy if activity present.

**Audit** | app.dev | ☐ | ☐ | | | |

---

### WEB-SAVED-02 — Watch / unwatch

| Field | Value |
|-------|-------|
| **ID** | WEB-SAVED-02 |
| **Priority** | P0 |

**Steps** — Watch from detail; appears on Saved; unwatch removes.

**Audit** | app.dev | ☐ | ☐ | | | |

---

## Restaurant detail & contributions

### WEB-DET-01 — Restaurant detail

| Field | Value |
|-------|-------|
| **ID** | WEB-DET-01 |
| **Route(s)** | `/restaurants/:id` |
| **Priority** | P0 |

**Steps** — Open venue; TTF hero with tier dot; recency chart if contributions exist.

**Expected (theme)** — Speed number prominent; Bluebird cards/borders.

**Audit** | app.dev | ☐ | ☐ | | | |

---

### WEB-DET-04 — Recency histogram

| Field | Value |
|-------|-------|
| **ID** | WEB-DET-04 |
| **Priority** | P1 |

**Steps** — Venue with contributions → chart; stale callout if nothing in last 6 months.

**Audit** | app.dev | ☐ | ☐ | | | |

---

### WEB-TTF-01 — TTF submit timer

| Field | Value |
|-------|-------|
| **ID** | WEB-TTF-01 |
| **Route(s)** | `…/submit` |
| **Priority** | P0 |

**Steps** — Start timer; submit observation; mango/primary CTAs readable.

**Audit** | app.dev | ☐ | ☐ | | | |

---

## Account & legal

### WEB-ACCT-01 — Account settings

| Field | Value |
|-------|-------|
| **ID** | WEB-ACCT-01 |
| **Route(s)** | `/account` |
| **Priority** | P0 |

**Steps** — Family profile, notification prefs, theme toggle, sign out.

**Expected (theme)** — Checkbox rows use `field-row`; brand focus rings.

**Audit** | app.dev | ☐ | ☐ | | | |

---

### WEB-LEGAL-01 — Privacy policy

| Field | Value |
|-------|-------|
| **ID** | WEB-LEGAL-01 |
| **Route(s)** | `/privacy` |
| **Priority** | P2 |

**Audit** | app.dev | ☐ | ☐ | | | |

---

## Admin (P1 — requires IAP)

### ADM-DASH-01 — Overview attention cards

| Field | Value |
|-------|-------|
| **ID** | ADM-DASH-01 |
| **Surface** | admin |
| **Priority** | P1 |

**Audit** | admin.dev | ☐ | ☐ | | blocked if no IAP | |

---

### ADM-MOD-01 — Moderation queue

| Field | Value |
|-------|-------|
| **ID** | ADM-MOD-01 |
| **Priority** | P1 |

**Audit** | admin.dev | ☐ | ☐ | | | |

---

### ADM-THEME-01 — Admin Bluebird readability

| Field | Value |
|-------|-------|
| **ID** | ADM-THEME-01 |
| **Priority** | P1 |

**Steps** — ScoutLogo in admin sidebar; accent links readable on sky brand tokens.

**Audit** | admin.dev | ☐ | ☐ | | | |

---

## iOS (manual — simulator/device)

### IOS-MAP-01 — Teardrop pins + POI off

| Field | Value |
|-------|-------|
| **ID** | IOS-MAP-01 |
| **Surface** | ios |
| **Priority** | P0 |

**Steps** — Explore tab; teardrop annotations; no business POI icons; tier colors match web.

**Note** — Basemap stays Apple default (see MAP_STYLE.md).

**Audit** | device | ☐ | ☐ | | defer in cloud VM | |

---

### IOS-SAVED-01 — Saved tab

| Field | Value |
|-------|-------|
| **ID** | IOS-SAVED-01 |
| **Priority** | P1 |

**Audit** | device | ☐ | ☐ | | | |

---

## API smoke

### API-SMOKE-01 — Health

**Steps** — `curl https://api.dev.littlescout.app/health` → 200.

**Audit** | app.dev | ☑ 2026-06-20 | n/a | cloud-agent | HTTP 200 |

**Note:** Web theme flows (WEB-MAP-*, WEB-AUTH-*) require merge of `cursor-cloud-whimsical-bluebird-6c64` + deploy; validate locally via `cd web && npm run dev` until then.

---

## Catalog index (expand using template)

| ID | Title | Priority |
|----|-------|----------|
| WEB-AUTH-03 | Session persist redirect | P0 |
| WEB-SHELL-02 | Sidebar collapse | P1 |
| WEB-SHELL-04 | ActivityInbox portal | P1 |
| WEB-SHELL-05 | Desktop-only gate | P2 |
| WEB-MAP-06 | List rail tier swatches | P1 |
| WEB-MAP-07 | Explore filter bar | P1 |
| WEB-MAP-09 | Map sheet accent | P1 |
| WEB-MAP-10 | Search this area | P1 |
| WEB-SAVED-03 | Activity toast | P1 |
| WEB-SAVED-04 | Onboarding modal | P1 |
| WEB-DET-02 | Place-only detail | P1 |
| WEB-DET-05 | Google practical info | P1 |
| WEB-DET-06 | Report button | P1 |
| WEB-TTF-02 | TTF edit | P2 |
| WEB-RATE-01 | Attribute rating | P1 |
| WEB-REV-01 | Review chat | P2 |
| WEB-ACCT-02 | Notification prefs | P1 |
| WEB-ACCT-03 | My contributions | P1 |
| WEB-LEGAL-02 | Moderation policy | P2 |
| ADM-AUTH-01 | Admin sign-in | P1 |
| ADM-USR-01 | Contributor trust | P1 |
| ADM-DATA-01 | Observations | P1 |
| ADM-REST-01 | Restaurant merge | P1 |
| ADM-SEED-01 | Location seeding | P2 |
| IOS-MAP-02 | Legend + locate | P1 |
| IOS-DET-01 | Detail + practical | P1 |
| IOS-TTF-01 | TTF submit | P1 |
| IOS-ACCT-01 | Account | P1 |

---

*Last updated: Whimsical Bluebird rebrand (#63).*
