# #100 phase 2: live draft extraction, remove the preview step

Labels: next, area:web, area:api
Relates: #100

## Goal
`docs/MODERNIZATION.md` picked "3b, phased" for #100 — phase 2 (this issue) removes the explicit "Preview submission" tap by running extraction automatically after every assistant turn, so the draft card fills itself live while a parent is still standing in the restaurant. Depends on M05 (phase 1 re-skin) landing first since this issue reworks the same component.

## Changes
1. `web/src/components/ReviewChat.tsx`: today `extractContributionDraft` (imported from `web/src/lib/reviewChat.ts`) is only called inside `handlePreview()` (around line 107-123), triggered by the explicit "Preview submission" button (composer, around line 234-236). Change this so extraction runs automatically after each assistant reply lands in `sendMessage()` (around line 86-105) — call the same preview/extract pipeline (`extractContributionDraft` → `api.previewContributions`/`previewPlaceContributions`) right after `setMessages((prev) => [...prev, { role: "assistant", text: reply }])` succeeds, not gated on a button click.
2. Debounce the auto-extraction (e.g. only fire once per completed assistant turn, and skip if a request is already in flight) — reuse the existing `busy` state or add a dedicated `extracting` flag so the chat input isn't blocked while extraction runs in the background.
3. Remove the "Preview submission" `Button` from the composer (around line 234-236) — extraction is no longer a manual action. Keep "Send" as the only composer action.
4. Draft card behavior: replace the binary `!preview` / `preview` disclosure text (around line 284-289: "Fields appear here as you chat — tap Preview submission...") with a readiness-tier presentation matching canvas `3b`:
   - No draft yet: ivory/neutral card, "Your draft" header, empty state copy.
   - Draft has `missing_required` entries: amber card border/background (reuse `--color-warning`/`ttf-ok` soft token, e.g. `bg-warning-soft`/`border-warning` if such utility classes exist after M01 token regen — check `web/src/styles/tokens.generated.css` for the generated class names), header reads "N to add" using `preview.missing_required.length` (this count logic already exists via `pendingCount` around line 305).
   - `preview.ready_to_submit`: fast-green card (reuse TTF-fast soft token), header reads "Ready".
5. Move the `Submit review` button (currently rendered inside `draftPanel` only when `preview.ready_to_submit`, around line 278-282) so it's clearly part of the draft card in both the sidebar rail and the mobile disclosure — it already lives in `draftPanel` which is shared by both, so this is mostly a matter of confirming layout/visual hierarchy per canvas `3b`, not new logic.
6. Per-field escape hatch: each extracted field chip needs a "✎ edit" affordance that opens the matching manual field pre-filled, rather than an all-or-nothing switch to the manual form. This is new: `DraftSummary` (around line 341-362) currently only renders read-only text bullets. Rework it to render editable chips (e.g. reuse `ChoiceChip`/`Input` components from `web/src/components/ui/`) — clicking a chip's edit icon should let the user override just that field's extracted value inline (stored in local component state) before submit, without leaving the chat. Wire corrected values into the `draft` object sent to `api.submitContributions`/`submitPlaceContributions`. If a full inline-edit-per-field UI is too large for one PR, land it as a follow-up sub-task but call that out explicitly in the PR description — do not silently ship the all-or-nothing fallback as "done."
7. Moderation copy: `toast(result.pending_review ? "Review submitted for moderation..." : "Review saved...")` (around lines 135-140, 148-153) is unchanged by this issue — confirm no copy edits are needed.

## Acceptance
- [ ] Sending a chat message triggers draft extraction automatically, with no separate "Preview submission" tap required
- [ ] The "Preview submission" button no longer exists in `ReviewChat.tsx`
- [ ] The draft card visually shifts between three states (empty/ivory, "N to add"/amber, "Ready"/green) as fields are extracted
- [ ] "Submit review" is reachable directly from the draft card in both sidebar (desktop) and disclosure (mobile) layouts
- [ ] Extraction calls are debounced — rapid message sends don't fire overlapping/duplicate extraction requests
- [ ] Moderation toast copy unchanged
- [ ] PR description explicitly states whether the per-field ✎ edit affordance shipped in full or as a scoped follow-up

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 3b
