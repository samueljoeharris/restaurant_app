# Web & App Best Practices — Little Scout

Operational guidance for auth, account deletion, caching, map search, and rating trust. Tailored to Little Scout’s stack (Firebase Auth, Cloud Run API, PostgreSQL, MapKit/web map, Google link-out).

**Status:** Research captured 2026-06-11. Use as an implementation checklist before pilot launch and App Store submission.

---

## Table of Contents

1. [Auth & sessions](#1-auth--sessions)
2. [Account & data deletion](#2-account--data-deletion)
3. [Caching strategy](#3-caching-strategy)
4. [Map search & geospatial performance](#4-map-search--geospatial-performance)
5. [Ratings, trust & moderation](#5-ratings-trust--moderation)
6. [Privacy & location data](#6-privacy--location-data)
7. [Implementation checklist](#7-implementation-checklist)
8. [References](#8-references)

---

## 1. Auth & sessions

Little Scout uses **Firebase Auth** as the identity provider. Postgres stores `firebase_uid` on contributions; there is no local users table. See [WEB_AUTH.md](WEB_AUTH.md) and [FIREBASE_AUTH.md](FIREBASE_AUTH.md). Admin: [ADMIN_AUTH.md](ADMIN_AUTH.md).

### Principles

| Rule | Why |
|------|-----|
| Verify every protected request server-side | Client-supplied `uid` can be forged; use `verifyIdToken()` or session-cookie verify |
| Authorization on server only | Client auth state is UX; role/admin checks belong in API middleware |
| Short-lived credentials | Firebase ID tokens expire in ~1 hour; refresh is SDK-managed |
| Re-auth for sensitive actions | Account deletion, email/password change, MFA enroll/unenroll |
| Defense in depth on writes | App Check + rate limits + auth (already planned in Tier 1 hardening) |

### Web client patterns

**Current (acceptable for POC):** Firebase JS SDK holds tokens in memory; `AuthContext` refreshes on auth state change; API calls send `Authorization: Bearer <id_token>`.

**Production hardening options:**

1. **Bearer tokens (simpler):** Keep Firebase SDK token management. Never persist tokens in `localStorage` or `sessionStorage`. Rely on SDK in-memory refresh.
2. **HttpOnly session cookies (stronger for web):** Exchange ID token for a Firebase [session cookie](https://firebase.google.com/docs/auth/admin/manage-cookies) on a server endpoint. Set `httpOnly`, `secure`, `sameSite=lax` (or `strict` where OAuth allows). Verify with `verifySessionCookie()` on each request. Revoke on logout and security events.

### API verification

```python
# Hot path (most reads/writes)
decoded = auth.verify_id_token(token)

# Sensitive routes (account delete, admin, claim changes)
decoded = auth.verify_id_token(token, check_revoked=True)
```

Verify once per request; cache the decoded token for the request lifetime, not across requests.

### Roles & admin

- Store `role: admin` in Firebase **custom claims** (≤ 1000 bytes total).
- Enforce on `/v1/admin/*` server-side.
- Do not put PII or large permission lists in claims.

### Security headers & transport

- HTTPS everywhere; HSTS on production hosts.
- Strict CORS allowlist (`app.dev.littlescout.app`, `localhost:5173`, etc.).
- Content-Security-Policy on web/admin SPAs.
- Sanitize freeform text (restaurant notes, `wait_context`) before storage and display.

### Sign-in UX

- Google: `signInWithRedirect` in production (see [WEB_AUTH.md](WEB_AUTH.md) OAuth checklist).
- Apple Sign-In required when offering other third-party sign-in on iOS (App Store).
- MFA: TOTP opt-in via Identity Platform (already configured).

---

## 2. Account & data deletion

Required for **App Store** (Guideline 5.1.1(v)) and **Google Play** when the app supports account creation. Must be easy to find in-app — not buried or web-only.

### Apple / Google requirements (summary)

| Requirement | Detail |
|-------------|--------|
| In-app entry point | Settings / Account → **Delete account** |
| Real deletion | Deactivate-only is insufficient |
| Personal data removed | All data associated with the account, subject to legal retention |
| User-generated content | Reviews, notes, photos tied to the user should be deleted or anonymized per policy |
| Transparency | Tell users what is deleted, what is retained (if any), and expected timeframe |
| Re-auth | Confirm identity before destructive action |

### What to delete for Little Scout

| Store | Data | Action on account delete |
|-------|------|--------------------------|
| Firebase Auth | User record | `auth.delete_user(uid)` |
| Postgres | `TTFObservation` rows | Delete or anonymize (see policy below) |
| Postgres | `RestaurantAttributeRating` rows | Delete or anonymize |
| Postgres | `RestaurantNote` rows | Delete (contains freeform PII) |
| Cloud Storage | `photo_url` uploads | Delete objects for user |
| Redis / CDN | Cached profile, lists | Purge keys tagged with `uid` |
| Analytics / logs | Request logs with `uid` | Redact or age out per retention schedule |
| Backups | Cloud SQL PITR / snapshots | Document backup TTL; purge on backup expiry |

### Contribution retention policy (choose one, document publicly)

**Option A — Full delete (recommended for v1):** Remove all user-authored rows. Restaurant aggregates recompute without that user’s data. Simplest for privacy and App Store review.

**Option B — Anonymize structured ratings:** Replace `firebase_uid` with a stable anonymous ID or `NULL`; keep numeric observations for aggregate quality. Still delete notes, photos, and Auth record. Requires clear privacy-policy language.

Do **not** keep freeform notes or photos after deletion.

### Suggested API flow

```
POST /v1/me/delete-account
  Authorization: Bearer <token>  (recent sign-in required)
  Body: { "confirm": true }

Server:
  1. Verify token (check_revoked=true)
  2. Require auth_time within last N minutes (or step-up MFA)
  3. Delete Cloud Storage objects for user
  4. DELETE FROM observations/ratings/notes WHERE firebase_uid = :uid
  5. Invalidate aggregate caches for affected restaurants
  6. auth.revoke_refresh_tokens(uid)
  7. auth.delete_user(uid)
  8. Write deletion audit log (uid hash, timestamp, status — no PII)
  9. Return 204
```

### Web / iOS UI

- **Account** page: “Delete account” with confirmation dialog explaining impact on contributions.
- Optional: email confirmation for async deletion (Apple allows manual/time-delayed process if disclosed).
- After delete: sign out locally, clear client caches, redirect to landing.

---

## 3. Caching strategy

Cache at three layers: **HTTP headers** (browser/CDN), **application cache** (Redis/in-memory, if added), and **client state** (React Query / SWR patterns in web).

### Cache-Control by endpoint type

| Endpoint / asset | Policy | Example |
|------------------|--------|---------|
| Fingerprinted JS/CSS | Long-lived, immutable | `max-age=31536000, immutable` |
| `index.html` / SPA shell | Revalidate every request | `no-cache` + ETag |
| Public restaurant list (bbox search) | Short CDN TTL + SWR | `public, s-maxage=60, stale-while-revalidate=300` |
| Restaurant detail + aggregates | Short TTL; invalidate on new rating | `public, s-maxage=30, stale-while-revalidate=120` |
| Metric definitions (seed data) | Longer TTL | `public, s-maxage=3600` |
| `/v1/me`, writes, admin | Never shared-cache | `private, no-store` |

### ETags

- Compute ETag from aggregate version: `hash(restaurant_id, max(observation.updated_at), count)`.
- Return `304 Not Modified` when `If-None-Match` matches — saves bandwidth on repeat map pans.

### Invalidation

Prefer **event-driven** invalidation over long TTL alone:

- On `POST` observation/rating/note → purge cache keys for that `restaurant_id` and any bbox tiles containing it.
- Use normalized cache keys: `restaurants:{geohash}:{filter_hash}` not raw float bbox strings.

### Stampede protection

- Jitter TTLs (±10%).
- Singleflight on cache miss for hot keys.
- `stale-while-revalidate` so expiry is not a latency spike.

### Google Maps content (legal constraint)

From [Google Maps Platform Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms):

| Google field | Cache rule |
|--------------|------------|
| `place_id` | May store **indefinitely** |
| `lat` / `lng` from Geocoding or Places | Temporarily only — **max 30 consecutive calendar days**, then delete |
| Other Places content (names, hours, photos from Google) | Generally **no caching** unless terms explicitly allow |

**Little Scout approach:** Store `google_place_id` and link-out URLs in Postgres (our data). Do not bulk-cache Google Places details. Use Google only for seeding/link-out, not as a read-through cache for the app.

---

## 4. Map search & geospatial performance

### Client (iOS MapKit / web map)

- Query on **map idle** or explicit “Search this area” — not every pan/zoom frame.
- Debounce viewport changes (300–500 ms).
- Cluster pins at low zoom; show individual venues when zoomed in.
- Request only fields needed for pins: `id`, `name`, `lat`, `lng`, `ttf_median`, `sample_size`, `tier`.
- Pilot-city bounding box enforced server-side (`pilot_city = dedham-ma`).

### API (PostGIS when scale requires)

```sql
-- Two-step spatial filter (index-friendly)
WHERE geom && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)
  AND ST_Intersects(geom, ST_MakeEnvelope(...))
```

- Index: `GIST` on `geometry`/`geography` column.
- Compound index when filtering by attributes + bbox: `(pilot_city, geom)`.
- **Avoid `OFFSET` pagination** on map results; use cursor/keyset on `(id)` or spatial sort key.
- For proximity: KNN with `<->` operator and GiST.

### Cache keys for map search

Normalize bbox to grid or geohash (precision 6–7 for metro search) so nearby pans hit the same cache entry:

```
restaurants:dedham-ma:u4ez:{filters=v1}
```

### Aggregates on map

- Precompute or cache TTF tier per restaurant; avoid N+1 aggregate queries per pin.
- Return `sample_size` and `updated_at` so UI can show confidence (gray pin when `< min_sample_size`).

---

## 5. Ratings, trust & moderation

Little Scout is crowd-sourced, not verified-purchase. Trust comes from structure, transparency, and abuse controls.

### Submission integrity

| Control | Implementation |
|---------|----------------|
| Auth required | All writes require Firebase token |
| Rate limits | Per-uid and per-IP (see `RATE_LIMIT_MAX_WRITES`) |
| App Check | `X-Firebase-AppCheck` on writes |
| Duplicate guard | One active TTF per user/restaurant/daypart/window, or idempotency key |
| Plausibility | Reject `elapsed_minutes` outside 0–120; flag outliers for review |

### Display trust signals

- Median TTF + p25/p75, not just mean.
- Sample size + last updated (“12 visits · updated 3 days ago”).
- Hide aggregates below `min_sample_size`; show “Be the first to rate.”
- Map pin tiers: green / yellow / red / gray (unknown) — see [DESIGN.md § TTF Tiers](DESIGN.md#5-ttf-metric--detailed-spec).

### Moderation (before broad launch)

- **Report** button on notes and photos.
- Admin queue: flag, approve, remove, ban uid.
- Auto-flag: URLs in notes, burst submissions, identical text, new-account spam.
- **Public moderation policy:** remove fake/policy-violating content; do not suppress negative ratings.
- FTC: publish genuine reviews; investigate reported fakes; do not edit review meaning.

### Photos

- Scan uploads for size/type; optional malware scan.
- Strip EXIF GPS from user photos before serving (location already sensitive).
- Delete photo objects when parent observation or account is deleted.

---

## 6. Privacy & location data

### Data minimization

| Data | Collect? | Retention |
|------|----------|-----------|
| User precise GPS trail | **No** — not needed | — |
| Map viewport / search bbox | Transient for query | Do not log raw coordinates in analytics |
| Restaurant lat/lng (curated) | Yes — core product | Indefinite (our data) |
| `ordered_at` / `served_at` on TTF | Yes — metric input | Life of observation or until account delete |
| IP / device in logs | Minimal for abuse | 30–90 days, then aggregate/redact |

### iOS

- Request location **when in use** only for “near me” / map centering.
- `NSLocationWhenInUseUsageDescription` must explain parent-focused map discovery.
- No background location in v1.

### Web

- Use browser geolocation only after explicit user action (button), not on page load.
- Fall back to pilot-city default center (Dedham).

### Regulatory alignment

- Privacy policy: what we collect, why, retention, deletion rights, third parties (Firebase, Google Maps, GCP).
- CCPA/GDPR: support access and deletion requests via same account-delete flow.
- Apple ATT not required unless cross-app tracking (avoid third-party ad SDKs).

---

## 7. Implementation checklist

Use this as a pre-launch gate. Check off in PRs or project tracking.

### Auth & security

- [ ] `AUTH_DEV_MODE=false` in production
- [ ] App Check enforced on write endpoints
- [ ] Rate limits on writes
- [ ] `check_revoked=true` on sensitive routes
- [ ] CORS + CSP configured on web/admin
- [ ] Re-auth / recent-login for account deletion

### Account deletion

- [ ] `POST /v1/me/delete-account` (or equivalent)
- [ ] Web **Account → Delete account** UI
- [ ] iOS **Settings → Delete account** UI (before App Store)
- [ ] Cloud Storage cleanup for user photos
- [ ] Aggregate cache invalidation after delete
- [ ] Deletion audit log (non-PII)
- [ ] Privacy policy updated with retention/deletion language

### Caching

- [ ] `Cache-Control` / ETag on public read endpoints
- [ ] Normalized geohash/tile cache keys for bbox search
- [ ] Event invalidation on new observation/rating
- [ ] Google `place_id` only for long-term Google fields; lat/lng refresh ≤ 30 days if sourced from Google

### Map & search

- [ ] Debounced / map-idle search
- [ ] Pin clustering at low zoom
- [ ] PostGIS GiST index (when restaurant count warrants)
- [ ] Cursor pagination for list endpoints
- [ ] Pilot-city bbox enforced server-side

### Trust & moderation

- [ ] Duplicate / rate submission guards
- [ ] Report flow for notes/photos
- [ ] Admin moderation queue
- [ ] Public moderation policy page
- [ ] Confidence display (sample size, recency)

### Privacy

- [ ] No background location (v1)
- [ ] EXIF strip on photo upload
- [ ] Log retention policy documented
- [ ] Privacy policy published (web + App Store)

---

## 8. References

| Topic | Source |
|-------|--------|
| Session management | [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) |
| Digital identity | [OWASP Developer Guide — Digital Identity](https://devguide.owasp.org/en/04-design/02-web-app-checklist/06-digital-identity/) |
| Firebase session cookies | [Firebase Admin — Manage Session Cookies](https://firebase.google.com/docs/auth/admin/manage-cookies) |
| Apple account deletion | [Offering account deletion in your app](https://developer.apple.com/support/offering-account-deletion-in-your-app) |
| Google Maps caching | [Maps Platform Service Specific Terms](https://cloud.google.com/maps-platform/terms/maps-service-terms) |
| Place ID storage | [Geocoding API Policies](https://developers.google.com/maps/documentation/geocoding/policies) |
| HTTP caching | [MDN — HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Caching) |
| Review moderation | [FTC — Featuring Online Customer Reviews](https://www.ftc.gov/business-guidance/resources/featuring-online-customer-reviews-guide-platforms) |
| PostGIS performance | [Geospatial API — Bounding box queries](https://www.geospatial-api.com/advanced-spatial-endpoint-implementation-data-contracts/bounding-box-spatial-index-queries/) |

### Related internal docs

- [DESIGN.md](DESIGN.md) — data model, TTF spec, map/search design
- [WEB_AUTH.md](WEB_AUTH.md) — public sign-in, Google, MFA
- [ADMIN_AUTH.md](ADMIN_AUTH.md) — operator IAP and admin claims
- [FIREBASE_AUTH.md](FIREBASE_AUTH.md) — token verification, App Check, rate limits
- [AUTH.md](AUTH.md) — auth doc index
- [GETTING_STARTED.md](GETTING_STARTED.md) — phased rollout checklist
