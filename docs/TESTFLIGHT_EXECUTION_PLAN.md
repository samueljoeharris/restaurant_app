# TestFlight Execution Plan — Little Scout iOS

**Goal:** an internal TestFlight beta of the Little Scout iOS app installable on real phones, with an app-flow quality bar worthy of the pilot: a parent mid-meal can find a place, start the timer, and log a kid-food-speed observation **in under 60 seconds, one-handed**.

**Status date:** 2026-07-03 · **Canonical queue:** [ROADMAP.md](ROADMAP.md) (GitHub issues) · **Companion docs:** [IOS_DESIGN.md](IOS_DESIGN.md), [ios.md](ios.md) (Swift best-practices review), [design-system/readme.md](design-system/readme.md) (Bluebird kit), [GETTING_STARTED.md](GETTING_STARTED.md)

---

## 1. Where we are

Everything below is verified against `main` as of 2026-07-03.

| Area | State |
|------|-------|
| Backend (API, Cloud SQL, Terraform, dev domains) | ✅ Live at `api.dev.littlescout.app`; ETag/SWR caching, write guards, rate limits merged |
| Web pilot | ✅ Live at `app.dev.littlescout.app` — reference implementation, mobile-optimized bottom nav shipped |
| iOS M0–M5 (scaffold → browse → map → auth → contribute → Apple Sign-In) | ✅ On `main` in `ios/TTF/` — builds, browses, signs in, submits TTF/attributes/notes |
| iOS map performance pass | ✅ P0/P1 from [ios.md](ios.md) done — camera tracking, coverage jobs, viewport filtering, `URLCache`, latest-wins cancellation |
| Account deletion (App Store requirement) | ✅ API + web + iOS ([#33](https://github.com/samueljoeharris/restaurant_app/issues/33) closed) |
| Sign in with Apple (App Store requirement) | ✅ Implemented; needs on-device smoke as part of beta validation |
| Privacy policy page | ✅ `/privacy` on web ([PRIVACY_POLICY.md](PRIVACY_POLICY.md)) |
| CI build workflow | ⚠️ `tool-ios.yml` builds for simulator on manual dispatch only; archive/sign/upload steps are **commented out** |
| Signing secrets | ❌ Not created — [#46](https://github.com/samueljoeharris/restaurant_app/issues/46), the single hard blocker |
| TestFlight app record + testers group | ❌ Not created — [#36](https://github.com/samueljoeharris/restaurant_app/issues/36) |
| Bluebird design parity on iOS (fonts, basemap, mascot) | ❌ Open — [#65](https://github.com/samueljoeharris/restaurant_app/issues/65), [#66](https://github.com/samueljoeharris/restaurant_app/issues/66), [#68](https://github.com/samueljoeharris/restaurant_app/issues/68) |

**Critical path in one line:** [#46](https://github.com/samueljoeharris/restaurant_app/issues/46) signing secrets (human, ~2h of portal work) → [#36](https://github.com/samueljoeharris/restaurant_app/issues/36) pipeline + first upload → [#40](https://github.com/samueljoeharris/restaurant_app/issues/40) invite testers. Nothing else blocks a beta build.

```mermaid
flowchart LR
    A46["#46 ASC secrets & signing<br/>(human, Apple portal)"] --> A36["#36 archive + upload stage<br/>in tool-ios.yml (agent)"]
    A36 --> FB[First internal build<br/>on your phone]
    FB --> UX[UX polish sprint<br/>(agent, parallel)]
    FB --> A40["#40 invite pilot testers"]
    UX --> A40
    A38["#38 hardening remainder"] -. before external testers .-> A40
```

---

## 2. Workstream A — Unblock signing (#46) · human, one-time

All portal steps; agents cannot do these. Budget one sitting (~2 hours).

1. **App Store Connect app record** — [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps → **+**:
   - Name **Little Scout**, bundle ID `com.samueljoeharris.ttf` (register the ID at [developer.apple.com/account](https://developer.apple.com/account) → Identifiers first, with the **Sign in with Apple** capability checked), SKU `littlescout-ios`, primary language English (U.S.).
2. **App Store Connect API key** — Users and Access → Integrations → App Store Connect API → generate a key with **App Manager** role. Download the `.p8` **once** (it can't be re-downloaded); note Issuer ID and Key ID.
3. **Distribution certificate** — Xcode → Settings → Accounts → Manage Certificates → **Apple Distribution**, then export as `.p12` with a password (Keychain Access).
4. **Provisioning profile** — developer portal → Profiles → **App Store** distribution profile for `com.samueljoeharris.ttf` → download `.mobileprovision`.
5. **GitHub Secrets** (`gh secret set ...` from the repo; names already expected by [`scripts/import-signing-material.sh`](../scripts/import-signing-material.sh) and [`ios/TTF/README.md`](../ios/TTF/README.md)):

   | Secret | Content |
   |--------|---------|
   | `APPSTORE_ISSUER_ID` | ASC API issuer ID |
   | `APPSTORE_KEY_ID` | ASC API key ID |
   | `APPSTORE_PRIVATE_KEY` | contents of the `.p8` |
   | `IOS_DEVELOPMENT_TEAM` | Apple team ID |
   | `IOS_BUILD_CERTIFICATE_BASE64` | `base64 -i dist.p12` |
   | `IOS_P12_PASSWORD` | `.p12` password |
   | `IOS_PROVISION_PROFILE_BASE64` | `base64 -i profile.mobileprovision` |
   | `IOS_GOOGLE_SERVICE_INFO_PLIST` | already used by the build job — confirm it's set (base64 of `GoogleService-Info.plist`) |

6. **TestFlight internal group** — ASC → the app → TestFlight → Internal Testing → group `ttf-pilot-testers`, add yourself. Internal testing (≤100 App Store Connect users) needs **no Beta App Review** — this is the fastest path to a build on your phone.

**Done when:** all eight secrets exist and the ASC app record shows in TestFlight.

---

## 3. Workstream B — TestFlight pipeline (#36) · agent-able once A lands

> **Status 2026-07-04: shipped.** `tool-ios.yml` now has the archive → `.ipa` export → TestFlight upload job behind a `testflight` dispatch input, with `ExportOptions.plist`, run-number build numbers, the encryption-compliance key, and `macos-15` runners. Untested until the #46 secrets exist; the provisioning-profile name in `ExportOptions.plist` may need a one-time edit. Items below kept for reference.

Extend [`tool-ios.yml`](../.github/workflows/tool-ios.yml). The commented-out skeleton is ~80% right; known corrections needed when uncommenting:

1. **Export an `.ipa`, not the `.xcarchive`.** `apple-actions/upload-testflight-build` expects an `.ipa`; the commented step passes `build/TTF.xcarchive`. Add after archive:
   ```yaml
   xcodebuild -exportArchive \
     -archivePath build/TTF.xcarchive \
     -exportOptionsPlist ExportOptions.plist \   # method: app-store-connect, team ID, profile mapping
     -exportPath build/export
   ```
   and upload `build/export/TTF.ipa`.
2. **Runner/Xcode:** move to `macos-15` (per [IOS_DESIGN.md §12](IOS_DESIGN.md#12-cicd--ios-workflow); `macos-14` images carry older Xcode; iOS 17 SDK headroom).
3. **Build numbers must be unique per upload.** Set `CURRENT_PROJECT_VERSION=${{ github.run_number }}` on the archive step (marketing version stays `0.1.0` from [`project.yml`](../ios/TTF/project.yml)) — otherwise the second upload is rejected.
4. **Encryption compliance:** add `ITSAppUsesNonExemptEncryption = NO` to [`Info.plist`](../ios/TTF/TTF/Resources/Info.plist) (currently missing) so every build doesn't stall on the ASC export-compliance question. Standard HTTPS-only qualifies as exempt.
5. **App icon check:** `AppIcon-1024.png` exists — verify it has **no alpha channel** (ASC rejects it; `scripts/make_app_icon.py` can strip alpha).
6. **Trigger:** keep `workflow_dispatch` with a `testflight: true` input for now; tag-based promotion later. macOS runner minutes are ~10× Linux — don't wire into `deploy.yml` push triggers yet.
7. **Release config sanity:** `Release.xcconfig` points at `https://api.dev.littlescout.app` with real Firebase and `TTF_APP_CHECK_ENABLED = NO` — correct for the internal pilot ([IOS_DESIGN.md §9](IOS_DESIGN.md#9-environments--configuration)).

**Done when:** dispatching the workflow with `testflight: true` produces a build visible in TestFlight and installable on your phone via the TestFlight app.

**First-build validation (on device):** cold launch < 2s to map · browse/search Dedham venues · Sign in with Apple end-to-end · submit a real TTF with the timer · rate two attributes · add a note · aggregates refresh · account deletion path reachable. Log results against [TEST_FLOWS.md](TEST_FLOWS.md).

---

## 4. Workstream C — Parent-on-the-go UX bar · agent-able, parallel with A/B

The web pilot went through the Bluebird pass; iOS still reads as a functional scaffold. These are the gaps found reviewing `ios/TTF/TTF/Views/` against the design kit and the 60-second-loop spec ([IOS_DESIGN.md §6](IOS_DESIGN.md#6-screens--navigation)). Ship the **Pre-beta** set before inviting testers beyond yourself — first impressions with pilot parents are one-shot.

### Pre-beta (the flagship loop must feel great)

> **Status 2026-07-04: C1–C5 all shipped.** Two-moment TTF timer flow with haptics; tap-to-draft attribute chips with single Save (~4 taps); floating search + suggestions on the Explore map; Quicksand/Nunito bundled with `Font.ls*` theme helpers (applied sparingly — broad application is follow-up). Bonus fixes: the checked-in Xcode project was missing 6 Swift files plus 4 latent compile errors (main had never compiled on a Mac since cloud agents wrote it), and `regenerate-ios-xcodeproj.py` now correctly emits Firebase SPM package refs, `Colors.xcassets`, and bundled fonts. Table kept for reference.

| # | Gap (file) | Fix |
|---|-----------|-----|
| C1 | **TTF submit is a generic `Form`** ([TtfSubmitView.swift](../ios/TTF/TTF/Views/TtfSubmit/TtfSubmitView.swift)): timer buried in a section, Start/Stop/Reset buttons, quality as a `Stepper`, "Submit TTF" jargon | Rebuild as the two-moment flow: full-width **"We just ordered"** → live big Quicksand-style timer (persist start to `UserDefaults`, per spec) → **"Food's here!"** → one quick-capture screen: segmented item type (emoji labels already exist), **tappable 1–5 star row**, portion/daypart pills with smart defaults (daypart from clock), kids stepper. Rename CTA to "Log it 🎉". Keep the manual-minutes fallback behind "Skip timer". |
| C2 | **Attribute rating needs N taps + N requests** ([RateAttributesView.swift](../ios/TTF/TTF/Views/Attributes/RateAttributesView.swift)): per-metric Save buttons, `Stepper`/`Toggle`/`Picker` rows | One screen of **AttributeChip-style controls** (design kit `components/core/`): yes/no chips, star rows, enum pills — tap to select, single **Save all** submitting only changed metrics. A parent tags "high chairs ✓, noise low, kids menu 4★" in ~5 taps. |
| C3 | **No search on the Explore (map) tab** — search lives only in Browse ([RootTabView.swift](../ios/TTF/TTF/Views/RootTabView.swift)); web puts search over the map | Add the search field (reuse [PlaceSearchField.swift](../ios/TTF/TTF/Views/Search/PlaceSearchField.swift) + suggestions) over the map, or make Browse the default tab. On-the-go flow is *search → tap → rate*, not *scroll a list*. |
| C4 | **System fonts / no brand type** — [#65](https://github.com/samueljoeharris/restaurant_app/issues/65) | Bundle Quicksand + Nunito; big timer digits and TTF badges in Quicksand are the single highest-leverage "feels like Little Scout" change. |
| C5 | **No haptics or micro-motion** | `sensoryFeedback(.success…)` on timer start/stop and submit success; 150/250ms `easeOut` transitions per kit motion rules ("gentle, no springs"). Cheap, makes everything feel snappier than it measures. |

### During beta (parallel with feedback gathering)

| # | Item | Ref |
|---|------|-----|
| C6 | MapKit basemap parity (warm-ivory land, sky water, POIs off) | [#66](https://github.com/samueljoeharris/restaurant_app/issues/66), [MAP_STYLE.md](MAP_STYLE.md) |
| C7 | Mascot empty/error states ("Be the first to log speed!") — assets exist from the web pass | [#68](https://github.com/samueljoeharris/restaurant_app/issues/68) |
| C8 | `MKLocalSearchCompleter` autocomplete for one-handed search | [ios.md §4](ios.md) (P2) |
| C9 | Watchlist/Saved parity + push | [#61](https://github.com/samueljoeharris/restaurant_app/issues/61), [#59](https://github.com/samueljoeharris/restaurant_app/issues/59) |
| C10 | Pin clustering + wiring bbox params on map reads (as catalog grows past ~1–2k) | [ios.md §1–2](ios.md) |
| C11 | iOS unit-test target (tier logic, timer math, decoding fixtures) | [IOS_DESIGN.md §11](IOS_DESIGN.md#11-testing-strategy) |

**"Snappy" is mostly already banked** — ETag + `URLCache`, viewport-filtered markers, latest-wins search cancellation all landed in the June performance pass ([ios.md](ios.md) implementation status). C5 + skeleton states are the remaining perceived-speed wins.

---

## 5. Workstream D — Release readiness & pilot (#38, #40)

- **Before any external (non-ASC-user) testers:** Beta App Review kicks in — needs the privacy policy URL (`https://app.dev.littlescout.app/privacy` works; a `littlescout.app` page is nicer), beta description, and review contact. Also flip on **App Check** (App Attest) per [IOS_DESIGN.md §8](IOS_DESIGN.md#8-auth) — registered but `TTF_APP_CHECK_ENABLED = NO` today. Not needed for the internal group.
- **[#38](https://github.com/samueljoeharris/restaurant_app/issues/38) remainder:** confirm the prelaunch-hardening branch merged and API deploy is green (branch no longer exists on origin — verify the write-guard tests run in CI); prod App Check key and CSP smoke stay deferred to prod cutover per the issue.
- **Pilot ([#40](https://github.com/samueljoeharris/restaurant_app/issues/40)):** invite 5–10 parent testers to `ttf-pilot-testers`; ask each for 2+ real TTF submissions in week one; watch admin console for data quality; funnel feedback to issues labeled `next`.

---

## 6. Sequence & suggested queue changes

| When | What | Who |
|------|------|-----|
| **Week 1** (by Jul 10) | Workstream A portal sitting → secrets in GitHub · agent extends `tool-ios.yml` (B1–B7) · first internal build on your phone · C4 fonts + C5 haptics land | You (A), agent (B, C4–C5) |
| **Week 2** (by Jul 17) | C1 TTF submit redesign · C2 attribute quick-rate · C3 map search · on-device smoke per [TEST_FLOWS.md](TEST_FLOWS.md) | Agent, you verify in Xcode/device |
| **Week 3** (by Jul 24) | Invite `ttf-pilot-testers` (#40) · during-beta UX items (C6–C8) as feedback arrives | You + agent |
| **Later** | App Check + external group · prod cutover ([#39](https://github.com/samueljoeharris/restaurant_app/issues/39), [PROD_CUTOVER_RUNBOOK.md](PROD_CUTOVER_RUNBOOK.md)) · C9–C11 | — |

**Label moves** (keep `now` ≤ 3 per [ROADMAP.md](ROADMAP.md)):
- [#46](https://github.com/samueljoeharris/restaurant_app/issues/46) `next` → **`now`** (it's the only real blocker; #36 is labeled `now` but can't move without it)
- File one new issue per pre-beta UX item C1–C3 (`area:ios`, `next`); C4/C5 fold into [#65](https://github.com/samueljoeharris/restaurant_app/issues/65) / a small polish issue
- [#64](https://github.com/samueljoeharris/restaurant_app/issues/64) web portion is largely shipped — consider closing in favor of the iOS-specific #65/#66/#68

## 7. Risks & gotchas

| Risk | Mitigation |
|------|------------|
| `.p8` key downloadable only once | Store in password manager the moment it's generated, then `gh secret set` |
| First upload rejected (icon alpha, missing compliance key, duplicate build number) | B3–B5 handle all three before the first dispatch |
| `project.pbxproj` corruption when agents add files | Known issue — regenerate via `python3 scripts/regenerate-ios-xcodeproj.py` or XcodeGen ([ios/TTF/README.md](../ios/TTF/README.md)) |
| macOS runner minute burn | Keep TestFlight stage on manual dispatch; simulator build job stays out of `deploy.yml` |
| SIWA works on simulator but not device | Smoke on a physical phone in the first-build validation; entitlement + Firebase provider are already configured |
| Beta points at **dev** API/Firebase | Acceptable and intended for the pilot; prod cutover is explicitly later (#39). Watch the $25/$50 GCP budget alerts as testers join |

---

## 8. Repo hygiene (found during this review)

- Untracked: `.cursor/rules/developer-workflow.mdc` — commit it (it encodes the solo-dev workflow) or ignore it deliberately.
- Unmerged remote branch: `cursor-cloud-synthetic-agent-users-2566` (agent-user playbook, 1 commit, 13 days old) — merge or delete.
- ~14 merged `cursor-cloud-*` remote branches can be pruned (`git push origin --delete ...` or via GitHub UI).
- [ROADMAP.md](ROADMAP.md) "Now" table lists #64 which carries no `now` label on GitHub — sync labels next hygiene pass ([BACKLOG_STATUS.md](BACKLOG_STATUS.md)).

---

*This plan is a point-in-time execution view; the living queue remains [ROADMAP.md](ROADMAP.md) + GitHub issues. Update or delete this file once the beta ships and #36/#40 close.*
