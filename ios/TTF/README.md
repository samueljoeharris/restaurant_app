# Little Scout — iOS (Phase 3)

Native **SwiftUI + MapKit + MVVM** client for the Dedham pilot. Connects to the same REST API as the web pilot at `https://api.dev.littlescout.app`.

## Requirements

- macOS with **Xcode 15+**
- Apple Developer Program (for device testing and TestFlight)
- Optional: [XcodeGen](https://github.com/yonaskolb/XcodeGen) if you prefer regenerating the project from `project.yml`

## Open the project

```bash
open ios/TTF/TTF.xcodeproj
```

### Troubleshooting “project is damaged”

The checked-in `project.pbxproj` must use **comma-separated** UUID lists (valid Xcode plist syntax). If Xcode refuses to open the project after adding files, regenerate it:

```bash
python3 scripts/regenerate-ios-xcodeproj.py
```

Or, with [XcodeGen](https://github.com/yonaskolb/XcodeGen) installed:

```bash
brew install xcodegen
./ios/TTF/generate-xcodeproj.sh
```

1. Select the **TTF** scheme and an iPhone simulator.
2. Set your **Development Team** in the TTF target → Signing & Capabilities.
3. Build and run (⌘R).

The app loads restaurants from the dev API without sign-in. Write endpoints (TTF submit, attribute ratings) require auth.

## Project layout

```
ios/TTF/
├── TTF.xcodeproj/          # Xcode project (checked in)
├── project.yml             # Optional XcodeGen spec
├── Config/                 # Debug/Release xcconfig (API URL)
└── TTF/
    ├── App/                # Entry point + AppConfig
    ├── Models/             # Codable types aligned with api/ + web/
    ├── Services/           # APIClient, AuthService, AppCheckService
    ├── ViewModels/         # MVVM state
    ├── Views/              # Map, list, detail, TTF submit, auth
    └── Resources/          # Info.plist, Assets
```

## Screens (scaffold)

| Tab / flow | View | API |
|------------|------|-----|
| Map | `RestaurantMapView` | `GET /v1/restaurants/map` |
| List | `RestaurantListView` | `GET /v1/restaurants` |
| Detail | `RestaurantDetailView` | `GET /v1/restaurants/{id}`, notes |
| Submit TTF | `TtfSubmitView` | `POST /v1/restaurants/{id}/ttf` |
| Attributes | `RateAttributesView` | `GET /v1/metrics`, attributes POST |
| Account | `AccountView` / `SignInView` | `GET /v1/me` |

Map pins use the same TTF tier colors as the web pilot (fast ≤8 min, ok 9–15, slow >15, unknown &lt;3 samples).

## API base URL

Default: `https://api.dev.littlescout.app` (via `Config/Debug.xcconfig` → `Info.plist`).

Overrides:

- **Scheme environment:** `TTF_API_URL` (highest priority at runtime)
- **Local API from Simulator:** set `TTF_API_URL = http://localhost:8080` in `Config/Debug.xcconfig` or the scheme

## Auth

Sign in with **Apple** (primary) or **email/password** (testing parity with web). Requires `GoogleService-Info.plist` from Firebase Console (gitignored — see `ios/.gitignore`).

### Apple Sign-In setup

1. Add `GoogleService-Info.plist` to the TTF target (Firebase Console → iOS app).
2. Enable **Sign in with Apple** in Xcode (already in `TTF.entitlements` — set your Development Team).
3. Enable Apple provider in [Firebase Console](https://console.firebase.google.com/project/ttf-restaurant-dev/authentication/providers).
4. Build and run on simulator (signed into an Apple ID under Settings) or device.

Email/password remains available for emulator testing (`TTF_USE_AUTH_EMULATOR = YES` in `Debug.xcconfig`).

### App Check (before external TestFlight)

`AppCheckService` is wired but **disabled by default** (`TTF_APP_CHECK_ENABLED = NO`). When ready:

1. Register the iOS app in [Firebase App Check](https://console.firebase.google.com/project/ttf-restaurant-dev/appcheck) (App Attest).
2. Set `TTF_APP_CHECK_ENABLED = YES` in `Release.xcconfig` (or scheme env).
3. For simulator debug tokens, use the App Check debug provider (DEBUG builds).

### Dev token (before Firebase is wired)

For testing write endpoints against the auth emulator or `AUTH_DEV_MODE` API:

1. Generate a token: `docker compose run --rm api python scripts/get_emulator_token.py`
2. In Xcode: **Product → Scheme → Edit Scheme → Run → Arguments → Environment Variables**
3. Add `TTF_DEV_TOKEN` = `dev:your-uid` or the emulator JWT

## Regenerate Xcode project (optional)

If you edit `project.yml`:

```bash
brew install xcodegen
./ios/TTF/generate-xcodeproj.sh
```

## TestFlight CI (skeleton)

`.github/workflows/tool-ios.yml` is a manual `workflow_dispatch` job for macOS builds. Before enabling the (currently commented-out) signing + TestFlight steps, add these GitHub secrets:

| Secret | Purpose |
|--------|---------|
| `APPSTORE_ISSUER_ID` | App Store Connect API issuer ID |
| `APPSTORE_KEY_ID` | App Store Connect API key ID |
| `APPSTORE_PRIVATE_KEY` | Contents of the `.p8` API key file |
| `IOS_DEVELOPMENT_TEAM` | Apple team ID |
| `IOS_BUILD_CERTIFICATE_BASE64` | base64 of the distribution cert `.p12` |
| `IOS_P12_PASSWORD` | Password for the `.p12` |
| `IOS_PROVISION_PROFILE_BASE64` | base64 of the `.mobileprovision` profile |

The cert/profile secrets are consumed by [`scripts/import-signing-material.sh`](../../scripts/import-signing-material.sh), which the workflow runs on the macOS runner before `xcodebuild archive`. Test it locally with:

```bash
RUNNER_TEMP=$(mktemp -d) \
  BUILD_CERTIFICATE_BASE64=$(base64 -i dist.p12) \
  P12_PASSWORD=... \
  BUILD_PROVISION_PROFILE_BASE64=$(base64 -i profile.mobileprovision) \
  ./scripts/import-signing-material.sh
```

## Related docs

- [docs/GETTING_STARTED.md](../../docs/GETTING_STARTED.md) — Phase 3 checklist
- [docs/DESIGN.md](../../docs/DESIGN.md) — product + iOS stack
- [docs/DESIGN_TOKENS.md](../../docs/DESIGN_TOKENS.md) — Bluebird theme tokens (`npm run tokens:generate` from `web/`)
- [docs/IOS_DESIGN.md](../../docs/IOS_DESIGN.md) — iOS architecture and milestones
- [api/openapi.yaml](../../api/openapi.yaml) — REST contract
- [web/src/api/client.ts](../../web/src/api/client.ts) — reference client
