---
name: little-scout-design
description: Use this skill to generate well-branded interfaces and assets for Little Scout — the social kid-food-speed restaurant app for parents — for production or throwaway prototypes/mocks. Contains the Bluebird theme guidelines, colors, type, fonts, reusable components, and app + admin UI kits.
user-invocable: true
---

Read the design kit manifest at [docs/design-system/readme.md](../../docs/design-system/readme.md), then explore:

- [docs/design-system/styles.css](../../docs/design-system/styles.css) + [docs/design-system/tokens/](../../docs/design-system/tokens/) — mock CSS tokens (`--ls-*`; runtime SOT is `design/tokens.json`)
- [docs/design-system/components/core/](../../docs/design-system/components/core/) — reference React primitives
- [docs/design-system/ui_kits/app/](../../docs/design-system/ui_kits/app/) and [admin/](../../docs/design-system/ui_kits/admin/) — full-screen recreations
- [docs/design-system/guidelines/](../../docs/design-system/guidelines/) — foundation specimen cards
- [docs/DESIGN_TOKENS.md](../../docs/DESIGN_TOKENS.md) — token workflow and regen command

**Production code:** edit `design/tokens.json`, run `npm run tokens:generate` from `web/`, use semantic Tailwind / `Color.brand`. See [.cursor/rules/design-tokens.mdc](../../.cursor/rules/design-tokens.mdc).

Key invariants: TTF tiers stay green/amber/red; brand = sky blue, accent = mango, paper = warm ivory; round generously; Quicksand for display/numbers, Nunito for UI/body; emoji used sparingly as wayfinding.

If the user invokes this skill without other guidance, ask what they want to build or design, then output HTML artifacts or production code as appropriate.
