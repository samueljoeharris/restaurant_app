# Admin account + access-denied pages

Labels: later, area:web

## Goal
`AdminAccountPage.tsx` is 554 bytes and, while not literally empty (it already shows the operator's email and an MFA/TOTP card), it has no claim status, no session info, and no accountability trail. `AdminAccessDeniedPage.tsx` already names the signed-in account but doesn't state the specific problem (missing admin claim) or offer a real "try another account" path. Close both gaps using existing auth/audit plumbing.

## Changes

### Admin account (`/admin/account`, canvas 6c)
1. `web/src/pages/admin/AdminAccountPage.tsx` (554 bytes today) currently renders only a `Page` wrapper + one `Card` with `MfaSettings`. Add a second card, "Operator status," showing: admin claim confirmation (`role=admin`, per `docs/ADMIN_AUTH.md`'s custom-claim model — read via the existing Firebase user/claims already available from `useAuth()`), MFA state (already computed inside `MfaSettings`; surface a one-line summary above/beside it rather than duplicating), and IAP session context. Note: `docs/ADMIN_AUTH.md` documents the IAP + Firebase-claim flow (`web/src/auth/iapSession.ts`) but does not document a session countdown/expiry value — derive "time remaining" client-side from the Firebase ID token's `exp` claim via `getIdTokenResult()`, not from a value ADMIN_AUTH.md provides today.
2. Add a "Your recent admin actions" card sourced from `admin_audit.py`'s `list_admin_audit_log` (`api/ttf_api/admin_audit.py:48`), filtered to `changed_by_uid == current user`, showing the last 3-5 actions (e.g. "approved note — Harbor Diner · 2h", per canvas `6c`) plus a link to the full audit log (already linked from Overview via "View audit log" in canvas `5a`; reuse that destination).
3. Keep the existing `MfaSettings` component and its flows untouched — this issue adds surrounding context, not new MFA behavior.

### Access denied (`/access-denied`, canvas 6d)
4. `web/src/pages/admin/AdminAccessDeniedPage.tsx` already renders "Signed in as `<email>`" — keep that, but make the headline copy specific per canvas `6d`: state plainly that the signed-in account lacks the admin claim (e.g. "You're signed in as `<email>`, which doesn't have the admin claim" instead of the current generic "You don't have permission to use the operator console.").
5. Add a "Switch account" primary action distinct from the current "Sign out" — it should sign out AND immediately re-trigger the IAP/Google sign-in prompt (or at minimum sign out and redirect to `/login`/IAP entry) so the operator doesn't have to separately notice they need to re-auth.
6. Add a "Request access" secondary action as a `mailto:` link (ops contact — check `docs/ADMIN_AUTH.md`'s "Grant admin access" section for the right contact/process to reference, e.g. pointing at whoever runs `api/scripts/set_admin_claim.py`).
7. Keep "Go to public app" as the back-to-app link, but per canvas `6d` render it as a lighter-weight text link rather than a full-width primary button, since "Switch account" is now primary.
8. Grayscale mascot: no mascot asset ships in `web/public` today — the only `mascot.svg` in the repo lives under `docs/design-system/reference/modernization-review/assets/` (canvas-only). Either add that asset to `web/public` (confirm licensing/source with design) or apply a `grayscale` CSS filter to the existing `ScoutLogo` component (`web/src/components/ScoutLogo.tsx`) as a pragmatic substitute — flag the choice in the PR description since the canvas assumes an asset that doesn't exist in product code yet.

## Acceptance
- [ ] `/admin/account` shows admin claim status, MFA state, and IAP/session info without removing the existing `MfaSettings` card.
- [ ] `/admin/account` lists the signed-in operator's own recent audit actions with a link to the full log.
- [ ] `/access-denied` states explicitly which signed-in account lacks the admin claim.
- [ ] `/access-denied` has a working "Switch account" primary action, a mailto "Request access" action, and a lightweight back-to-app link.
- [ ] Grayscale mascot/branding treatment resolved via either a shipped asset or a documented `ScoutLogo` grayscale fallback — not left as a missing asset reference.

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 6c, 6d
