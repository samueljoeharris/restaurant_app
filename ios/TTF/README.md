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

**Important:** The iOS app lives on branch `cursor/ios-scaffold-9c9f` until merged to `main`. If you are on `main`, run `git checkout cursor/ios-scaffold-9c9f` first.

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
    ├── Services/           # APIClient, AuthService (stub)
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

## Auth (next wiring step)

`AuthService` is a stub. To enable Apple Sign-In:

1. Add **Firebase iOS SDK** via Swift Package Manager (`firebase-ios-sdk`).
2. Download `GoogleService-Info.plist` from Firebase Console → add to the TTF target (gitignored — see `ios/.gitignore`).
3. Enable **Sign in with Apple** capability on the target.
4. Implement `AuthService.signInWithApple()` using `FirebaseAuth` + `ASAuthorizationAppleIDProvider`.
5. Enable Apple provider in [Firebase Console](https://console.firebase.google.com/project/ttf-restaurant-dev/authentication/providers).

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

`.github/workflows/tools/ios.yml` is a manual `workflow_dispatch` job for macOS builds. Before using it, add GitHub secrets:

| Secret | Purpose |
|--------|---------|
| `APPSTORE_ISSUER_ID` | App Store Connect API |
| `APPSTORE_KEY_ID` | API key ID |
| `APPSTORE_PRIVATE_KEY` | Contents of `.p8` file |
| `IOS_DEVELOPMENT_TEAM` | Apple team ID |

## Related docs

- [docs/GETTING_STARTED.md](../../docs/GETTING_STARTED.md) — Phase 3 checklist
- [docs/DESIGN.md](../../docs/DESIGN.md) — product + iOS stack
- [api/openapi.yaml](../../api/openapi.yaml) — REST contract
- [web/src/api/client.ts](../../web/src/api/client.ts) — reference client
