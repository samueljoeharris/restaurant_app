# Auth — index

Little Scout has **two independent auth paths**. Read the doc that matches what you are working on.

| You are building… | Read |
|-------------------|------|
| Public web pilot (`app.dev`) — sign up, sign in, Google, MFA, API calls | **[WEB_AUTH.md](WEB_AUTH.md)** |
| Operator console (`admin.dev`) — IAP, admin claims, Firebase SSO bridge | **[ADMIN_AUTH.md](ADMIN_AUTH.md)** |
| API JWT verification, dev tokens, emulator, App Check, Cloud Run env | **[FIREBASE_AUTH.md](FIREBASE_AUTH.md)** |

---

## Quick comparison

| | Public app (`app.dev`) | Admin console (`admin.dev`) |
|--|------------------------|----------------------------|
| **Who** | Parents / pilot users | Operators |
| **Entry** | `/login` — email, Google | Google IAP at load balancer |
| **Identity** | Firebase Auth (email, Google) | IAP Google account → Firebase custom token |
| **API auth** | `Authorization: Bearer <firebase_id_token>` | Same header; `/v1/admin/*` also requires `role=admin` claim |
| **OAuth client** | Firebase “Web client (auto created by Google Service)” | Separate IAP OAuth client (`IAP-ttf-dev-admin-backend`) |

Both share Firebase as the API identity layer, but **sign-up / sign-in UX applies only to the public app**. Admin production never shows the public login form.

---

## Shared facts

- **No local users table** — Postgres stores `firebase_uid` on contributions only.
- **Write endpoints** require a verified Firebase JWT (or `dev:<uid>` when `AUTH_DEV_MODE=true` locally).
- **Admin role** is a Firebase custom claim set via `api/scripts/set_admin_claim.py`.

---

## Related

- [ARCHITECTURE.md](ARCHITECTURE.md) — diagrams and component map
- [BEST_PRACTICES.md](BEST_PRACTICES.md) — sessions, deletion, hardening
- [GETTING_STARTED.md](GETTING_STARTED.md) — phase checklist
