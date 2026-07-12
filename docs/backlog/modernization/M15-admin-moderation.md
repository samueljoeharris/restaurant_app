# Moderation queue upgrades

Labels: next, area:web, area:api
Relates: #62, #44

## Goal
Give moderators the context and speed tools the canvas calls for: contributor trust history inline on each card, visible PII/flag highlighting inside note text, a middle "approve with redaction" action, and keyboard shortcuts so a shift through the queue doesn't require mousing to every button.

## Changes
1. `web/src/pages/admin/AdminModerationPage.tsx` currently renders `author_trust_level` as a bare `StatusBadge` (line ~138-140) with no counts. Extend the moderation list API response (`moderation_service.py`, the query backing the admin moderation list endpoint) to include `author_prior_count` and `author_rejected_count`, and render them next to the trust badge, e.g. `🥾 Trail Scout · 41 prior, 0 rejected` (see canvas `5b`). Tier labels come from `web/src/lib/contributorTrust.ts`.
2. Add flagged-span highlighting: when `flag_reasons` includes a PII-style reason (e.g. `phone_number`/`pii`), wrap the matched substring in the `preview`/note text with a `<mark>` using the `ttf-ok-soft`/`ttf-ok` token pair (see canvas `5b`'s phone-number example) so moderators see exactly what tripped the flag without re-reading the whole note.
3. Add a "Approve without phone #" middle action in `web/src/components/admin/ModerationActions.tsx` (or wherever `ModerationActions` lives, referenced from `AdminModerationPage.tsx:156-161`) between Approve and Reject. Wire it to a new redaction path: either a new `moderation_service.py` function that strips the flagged span before calling the existing approve path (`approve_moderation_item`, `api/ttf_api/moderation_service.py:137`), or a query param on the existing approve call. Only show this button when the item's `flag_reasons` includes a redactable PII flag.
4. Add keyboard shortcuts A (approve), R (reject), E (escalate) scoped to the focused/hovered row in `AdminModerationPage.tsx`, matching canvas `5b`'s `⌨️ A approve · R reject · E escalate` hint. Disable shortcuts while any text input/select has focus.
5. Replace the single `status` `<select>` (currently `pending` / `escalated` / `all`, `AdminModerationPage.tsx:91-95`) with filter pills: Pending, Escalated, Resolved, matching canvas `5b`. Note: the backend `status` enum (migration `010_admin_moderation.sql`) is `pending | approved | rejected | escalated | removed` — there is no single `resolved` value, so "Resolved" must be composed client-side (or via a new `status=resolved` alias in the API) covering `approved` + `rejected`. Flag this as a real gap, not a typo.

## Acceptance
- [ ] Each moderation card shows trust tier + prior/rejected counts sourced from the API, not hardcoded.
- [ ] PII-flagged notes render the offending span with the `ttf-ok`/`ttf-ok-soft` highlight tokens.
- [ ] "Approve without phone #" appears only on PII-flagged items and calls a redacting approve path; the resulting content has the flagged span removed, and the action is audit-logged same as approve/reject/escalate.
- [ ] A/R/E keyboard shortcuts work on the focused row and are inert while a form field has focus.
- [ ] Filter pills read Pending / Escalated / Resolved; "Resolved" is documented as approved+rejected combined given the current status enum has no literal "resolved" value.
- [ ] TEST_FLOWS.md `ADM-MOD-01` updated/extended to cover the new actions and shortcuts.

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 5b
