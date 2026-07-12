# #100 phase 1: re-skin log-a-visit chat to DS tokens

Labels: now, area:web
Relates: #100

## Goal
`docs/MODERNIZATION.md` picked the phased approach for #100: phase 1 re-skins the existing "Log a visit" chat (as shipped) with DS tokens and small interaction fixes, phase 2 (M06) does the bigger live-draft rework. This issue is phase 1 only — small, safe, no new extraction behavior.

## Changes
1. `web/src/components/ReviewChat.tsx`, `messageList` render (around line 196-208): both assistant and user bubbles currently share one `rounded-md` class (uniform 14px on all four corners per current DS `--radius-md`). Change to DS chat-bubble radii with a directional "tail" corner:
   - Assistant bubble (`self-start`, `bg-surface`): `rounded-tl-md rounded-tr-md rounded-br-md rounded-bl-sm` — i.e. all corners `--radius-md` (14px) except the bottom-left corner at `--radius-sm` (10px, closest DS scale value to the 4px tail called for in the mock; use an arbitrary value `rounded-bl-[4px]` if the design intent of a tight 4px corner matters more than reusing the `sm` token — prefer the literal 4px to match the canvas spec exactly).
   - User bubble (`self-end`, `bg-brand-soft`): mirror it — sharp corner on the bottom-right (`rounded-br-[4px]`), 14px everywhere else.
   - Do this with a small conditional in the existing `cn(...)` call rather than duplicating the whole className string.
2. Draft disclosure default-open state: `<details ... open={Boolean(preview)}>` (around line 330) already opens once `preview` (the extracted draft) is non-null, which is functionally "opens once ≥1 field has been extracted" — confirm this is still correct after any changes in step 1, no change needed unless testing reveals otherwise.
3. "Still needed" label color: `web/src/components/ReviewChat.tsx` (around line 258-259) already uses the semantic `text-warning` Tailwind class, not a hardcoded hex — good, no code change needed here. The actual bug is that `--color-warning` currently resolves to the drifted `#B54708` instead of TTF-ok amber `#E0A52E`; this is fixed by **M01** (token regeneration), which this issue depends on. Sequence M05 after M01 lands, or verify M01's token change is present before merging this issue's visual QA.
4. Desktop rail: `md:grid-cols-[1fr_20rem]` grid (around line 315) is already in place — keep it, no change.
5. Manual-fallback affordance: `web/src/pages/LogVisitPage.tsx` (`AgentLogVisit`, around line 74-79) already renders a "Rather not chat? Fill it out yourself" banner with a link to `restaurantManualSubmitPath` — confirm the copy and placement match canvas `3a` (surface-muted rounded panel above the chat); no functional change expected, only re-check styling once M01 tokens land (surface-muted, border colors change).
6. Verify `radius.lg` change from M01 (20px → 18px) doesn't visually break the `Card` components wrapping the chat (`web/src/components/ui/Card.tsx`) — spot check only, no code change expected unless Card hardcodes a radius value instead of using the token.

## Acceptance
- [ ] Assistant chat bubbles render with a sharp bottom-left corner, all others rounded 14px
- [ ] User chat bubbles render with a sharp bottom-right corner, all others rounded 14px
- [ ] "Still needed" text renders in TTF-ok amber (post-M01) — verify visually, not just via class name
- [ ] Draft disclosure opens automatically the first time a draft is extracted (`preview` becomes non-null) and stays available to re-collapse
- [ ] Desktop layout still uses the `md:grid-cols-[1fr_20rem]` two-column rail
- [ ] No change to `extractContributionDraft` call timing or the "Preview submission" button in this issue — that's M06's scope

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 3a
