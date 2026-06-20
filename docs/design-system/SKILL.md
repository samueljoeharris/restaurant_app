---
name: little-scout-design
description: Use this skill to generate well-branded interfaces and assets for Little Scout — the social kid-food-speed restaurant app for parents — for production or throwaway prototypes/mocks. Contains the Bluebird theme guidelines, colors, type, fonts, reusable components, and app + admin UI kits.
user-invocable: true
---

Read the `readme.md` file within this skill, then explore the other available files:
- `styles.css` + `tokens/` — the color, type, spacing, and effect tokens (link `styles.css` to inherit them).
- `components/core/` — reusable React primitives (Button, AttributeChip, SpeedBadge, UpdateCard, Toggle, BottomNav) with `.d.ts` props and `.prompt.md` usage.
- `ui_kits/app/` and `ui_kits/admin/` — full-screen recreations to copy from.
- `guidelines/` — foundation specimen cards.
- `reference/` — the original low-fi wireframes (provenance).

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets out and create static HTML files for the user to view, using the tokens in `styles.css`. If working on production code, copy the rules here and become an expert designing with the Little Scout brand.

Key invariants: keep the **kid-food-speed (TTF) tiers** green/amber/red regardless of theme; brand = sky blue, accent = mango, paper = warm ivory; round generously; Quicksand for display/numbers, Nunito for UI/body; emoji used sparingly as wayfinding.

If the user invokes this skill without other guidance, ask what they want to build or design, ask a few questions, and act as an expert designer who outputs HTML artifacts or production code, depending on the need.
