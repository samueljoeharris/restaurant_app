# Account page — Bluebird spec

Canonical visual spec for **`AccountPage`** (`/account`) in the public web pilot. Production implementation: [`web/src/pages/AccountPage.tsx`](../../web/src/pages/AccountPage.tsx).

**Related mocks:** [ui_kits/app/index.html](../ui_kits/app/index.html) (tab **account**), [Little Scout Full Kit.dc.html](../Little%20Scout%20Full%20Kit.dc.html) (**06 · You**).

**QA:** [TEST_FLOWS.md](../../TEST_FLOWS.md) — `WEB-ACCT-01`.

---

## Layout (top → bottom)

1. **Profile hero** — 56px avatar circle (🙂 on `bg-brand-soft`, sky border), display name (Quicksand ~19px), scouting subtitle from kids ages ("Scouting for a 2-year-old").
2. **Stat pills** — three equal columns: visits logged (brand sky), saved spots (mango accent), badge (pop orange — ★ Trail Scout when ≥3 contributions, else 🌱 New scout).
3. **SETTINGS eyebrow** — tracked uppercase label (`--text-label`, muted).
4. **Toggle rows** — white cards, 14px radius, pill switch (42×24px, sky when on). Weekly digest maps to `cadence === weekly`; other rows map to notification preference keys.
5. **Link rows** — same card shell, trailing chevron (›): My contributions, Privacy & data.
6. **Panels** — family profile, appearance (theme segmented control), security (MFA), delete account. Use `SettingsPanel` header + body; keep destructive actions in delete panel only.
7. **Sign out** — ghost button; muted sign-in method line below.

No page-level `Settings` h1 — the hero replaces it.

---

## Voice & copy

- Subtitle uses [scout framing](../readme.md#content-fundamentals): parent-to-parent, age-aware.
- Badge **Trail Scout** is light gamification — earned at 3+ contributions; not shown as a separate nav item.
- Sentence case labels; eyebrow is the only tracked uppercase block on this screen.

---

## Tokens & components

| Element | Token / component |
|---------|-------------------|
| Paper background | `bg-bg` + dot grid (global) |
| Avatar | `bg-brand-soft`, `border-brand/30` |
| Stat numbers | `font-display`, tier colors via `text-brand` / `text-accent` / `text-accent-pop` |
| Settings row | `rounded-[14px]`, `border-border`, `bg-surface`, `shadow-sm` |
| Toggle track | `bg-brand` on, `bg-border-strong` off |
| Focus | brand ring (3px, 18% mix) — same as form controls |

Reuse: [`AccountStatPill`](../../web/src/components/account/AccountStatPill.tsx), [`SettingsRow`](../../web/src/components/account/SettingsRow.tsx), [`Toggle`](../../web/src/components/ui/Toggle.tsx).

---

## Functionality (must preserve)

All pre-Bluebird features remain — layout only changes:

- Family profile PATCH (`kids_ages`, onboarding complete)
- Notification preferences PATCH (toggles + cadence select)
- Theme mode (system / light / dark)
- MFA enroll / unenroll (`MfaSettings`)
- Account deletion (`DeleteAccountSettings`)
- Operator console link when admin
- Link to `/account/contributions` and `/privacy`

---

## Don'ts

- No stacked legacy `Card` sections with duplicate "Settings" title.
- No sharp corners on settings rows (min 14px radius).
- Don't hide delete account or MFA behind unrelated nav — keep in panels on this route.

---

*Added with Bluebird account rebuild (#64 follow-up).*
