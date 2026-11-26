# API

Base URL: `http://localhost:4100/api/v1` in development. All routes are JSON.
The API also serves the built PWA on the same origin.

## Conventions

- **Auth header:** `Authorization: Bearer <accessToken>` for every route marked
  *learner*, *staff* or *role* below.
- **Access token lifetime:** 30 minutes. Refresh with `POST /auth/refresh` before
  it expires; the old refresh token is rotated and revoked.
- **Errors** always have this shape:

  ```json
  {
    "error": {
      "code": "VALIDATION",
      "message": "Please check the information.",
      "fields": [{ "path": "phone", "message": "Enter a Nigerian phone number." }]
    }
  }
  ```

  Common codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
  `VALIDATION` (400), `RATE_LIMITED` / `RESEND_COOLDOWN` (429), `LOCKED` (423),
  `ERROR` (500).
- **Roles:** `LEARNER`, `FACILITATOR`, `FAMILY`, `ADMIN`.
- **Languages:** `en`, `yo`, `ig`, `pcm`.
- **Timestamps** are ISO-8601 strings.

---

## Public

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness. `{ ok, appName, time }` |
| `GET` | `/config` | App name, tagline, languages, pilot flag, provider names, retention, `demo` |
| `GET` | `/paths?lang=en` | Learning paths with translated titles and lesson counts |
| `GET` | `/ui-strings/:lang` | UI strings for a language, with per-key translation status |
| `GET` | `/scam/examples?lang=&type=` | Seeded scam examples (also used by the checker's practice list) |

`/config` reports `demo: true` outside production. Provider names are `mock`
unless real keys are configured.

---

## Auth

### `POST /auth/otp/request`

```json
{ "phone": "08030000001", "displayName": "Ada", "lang": "en" }
```

- 60-second resend cooldown, 5-minute code expiry, 15-minute lockout after 5
  wrong attempts.
- Response: `{ "ok": true, "resendIn": 60, "devCode": "123456" }`.
- `devCode` is present when `DEMO_OTP=true` (demo mode: no SMS is sent and the
  page shows the code), or outside production while `SMS_PROVIDER=mock`.
  With a real SMS provider and `DEMO_OTP` off it is never returned.

### `POST /auth/otp/verify`

```json
{
  "phone": "08030000001",
  "code": "123456",
  "displayName": "Ada",
  "lang": "en",
  "goalPathSlug": "phone-basics",
  "agree": true,
  "helper": false
}
```

Creates the learner on first use. `agree` is required for a new account and
records terms, privacy and AI-notice consent. Response:
`{ accessToken, refreshToken, user, isNew }`.

### `POST /auth/login`

Staff, family and admin only.

```json
{ "email": "admin@sabi.app", "password": "Admin123!" }
```

Response: `{ accessToken, refreshToken, user }`. Lockout after 5 failures.

### `POST /auth/refresh`

```json
{ "refreshToken": "..." }
```

Rotates the refresh token. Response: `{ accessToken, refreshToken, user }`.

### `POST /auth/logout`

```json
{ "refreshToken": "..." }
```

Revokes the token if supplied. Response: `{ ok: true }`.

---

## Me and privacy

All routes require a signed-in user.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/me` | Current profile (`PublicUser`) |
| `PATCH` | `/me` | Update `displayName`, `preferredLang`, `textSize`, `theme`, `reduceMotion`, `goalPathSlug` |
| `GET` | `/me/export` | Download everything held about the user as JSON |
| `DELETE` | `/me` | Delete the account, progress, consents, tokens and OTP rows; revoke family links |
| `GET` | `/me/consents` | Consent history |
| `POST` | `/me/consents` | Record a choice |

`POST /me/consents` body:

```json
{ "type": "store_transcripts", "granted": false }
```

Allowed types: `terms`, `privacy`, `ai_notice`, `store_transcripts`,
`family_link`, `analytics`. Withdrawing `family_link` revokes every active link
for that learner.

---

## Content

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/paths` | public | Path summaries |
| `GET` | `/paths/:slug?lang=` | user | Path with lessons and progress-free detail |
| `GET` | `/lessons/:slug?lang=` | user | Lesson steps, checks and translation status |
| `GET` | `/lessons/:slug/bundle?lang=` | user | Everything needed to render the lesson offline |

Every translated field carries `status` (`approved`, `needs_review`, `machine`,
`draft`, `fallback`, `missing`) so the client can show the translation notice.

---

## Learning

| Method | Path | Body | Purpose |
| --- | --- | --- | --- |
| `GET` | `/progress` | — | All progress rows for the user |
| `PUT` | `/progress/:lessonSlug` | `{ stepIndex, completed?, stuck? }` | Save the furthest step; increments the stuck counter |
| `POST` | `/progress/sync` | `{ items: [...] }` | Reconcile offline rows (max 200) |
| `POST` | `/sandbox/attempts` | `{ taskId, success, hintsUsed? }` | Record a practice attempt |

`PUT /progress/:lessonSlug` never moves a learner backwards:
`stepIndex = max(existing, incoming)`.

`POST /progress/sync` accepts rows newer than the stored `updatedAt` and returns
`{ applied, progress, syncedAt }`. It is the only reconciliation point for
offline work.

---

## Assistant and scam checker

### `POST /assistant/turn`

Requires a signed-in user. Typed text only — there is no audio field.

```json
{ "text": "How do I send a voice note on WhatsApp?", "lang": "en" }
```

Response (`AssistantReply`):

```json
{
  "transcript": "…",
  "language": "en",
  "replyLang": "en",
  "confidence": 0.82,
  "reply": "Open the chat…",
  "promptVersion": "…",
  "safety": { "flagged": null, "message": null }
}
```

- Max 600 characters, 20 turns per minute per user.
- `safety.flagged` names a crisis or secret-handling path when one fired.
- The typed question is not stored unless the learner granted
  `store_transcripts`.

### `POST /scam/check`

```json
{ "text": "Dear customer, send your OTP to 0803…" }
```

Response: `{ verdict, confidence, headline, reasons, nextSteps, redFlags, critical }`.
`verdict` is one of `scam`, `unsure`, `safe`. `critical` is true when the message
asks for a credential. Text is limited to 2000 characters.

---

## People, family and groups

All routes below require a signed-in user; role limits are shown.

### Help requests

| Method | Path | Role | Purpose |
| --- | --- | --- | --- |
| `POST` | `/help-requests` | any | Ask for a call back, WhatsApp message or facilitator |
| `GET` | `/help-requests` | facilitator/admin | Requests for learners in the caller's groups |
| `PATCH` | `/help-requests/:id` | facilitator/admin | Set `status` to `open`, `contacted` or `resolved` |

`POST /help-requests` body:

```json
{ "type": "call_back", "context": { "lessonSlug": "answer-and-end-a-call" } }
```

Response `201` includes a `triage` object:

```json
{
  "route": "facilitator",
  "priority": "now",
  "urgent": true,
  "source": "local",
  "model": null,
  "probabilities": {},
  "requestId": null
}
```

`source` is `drex` when the Nace API answered and `local` when the fallback
rules did. The request is created even if triage fails.

### Groups

| Method | Path | Role | Body |
| --- | --- | --- | --- |
| `GET` | `/groups` | facilitator/admin | — |
| `POST` | `/groups` | facilitator/admin | `{ name, venue?, schedule? }` |
| `POST` | `/groups/:id/members` | facilitator/admin | `{ name, phone }` |
| `POST` | `/groups/:id/import` | facilitator/admin | `{ csv }` — `name,phone` per line |
| `GET` | `/groups/:id/progress` | facilitator/admin | — |
| `POST` | `/groups/:id/notes` | facilitator/admin | `{ notes }` |

A facilitator only reaches their own groups; an admin reaches all.

### Family links

| Method | Path | Role | Body |
| --- | --- | --- | --- |
| `POST` | `/family/invite` | learner | `{ phone, scopeProgress?, scopeScamAlerts?, scopeTranscripts? }` |
| `GET` | `/family/learners` | family/learner/admin | — |
| `POST` | `/family/accept` | family | `{ linkId }` |
| `DELETE` | `/family/:id` | either party | — |
| `POST` | `/family/encourage` | family | `{ linkId, message }` |

A learner must have an active `family_link` consent before inviting. Scopes
default to progress only. Revoking a link is immediate and audited.

### Reminders

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/reminders` | — |
| `PUT` | `/reminders` | `{ channel, weeklyDay, hour, quietStart, quietEnd, active }` |
| `POST` | `/reminders/test` | — |

`channel` is `sms`, `whatsapp` or `in_app`. `weeklyDay` is 0–6 and `hour` is
0–23. Quiet hours use `HH:MM`.

---

## Admin

Every route requires `ADMIN`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/admin/translations?lang=&status=&q=&page=&limit=` | Paginated translation rows plus coverage |
| `PATCH` | `/admin/translations` | Edit text and/or set status |
| `GET` | `/admin/analytics` | Learner, completion, stuck, help, assistant and scam counts |
| `GET` | `/admin/audit-logs` | Latest 200 audit entries |
| `GET` | `/admin/users` | Non-deleted users, phones masked |
| `GET` | `/admin/scam-examples` | All examples |
| `POST` | `/admin/scam-examples` | `{ type, lang, text, isScam, redFlags? }` |
| `DELETE` | `/admin/scam-examples/:id` | Remove an example |
| `GET` | `/admin/glossary` | Glossary terms and Pidgin explanations |

`PATCH /admin/translations` body:

```json
{ "key": "ask.title", "lang": "yo", "text": "…", "status": "approved" }
```

Approving records the reviewer and timestamp.

---

## Static and fallbacks

- `GET /` and any non-`/api` path serve the built PWA when `apps/web/dist`
  exists.
- Unknown `/api` paths return `404` with `{ error: { code: "NOT_FOUND" } }`.
- A disallowed `Origin` returns `403` with `code: "CORS"`.
