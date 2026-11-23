# Architecture

## Shape of the system

```
Browser (React PWA)  ──►  Express API  ──►  JSON store (dev) / PostgreSQL (target)
        │                     │
        │                     ├──► LLM provider (mock | OpenAI chat)
        │                     └──► SMS provider (mock | Termii)
        │
        └── localStorage: session, settings, progress outbox, offline lesson bundles
```

One deployable process serves both the API and the built PWA. That keeps the
origin identical for the service worker, avoids CORS in production and makes
offline behaviour predictable.

## Workspaces

| Path | Responsibility |
| --- | --- |
| `apps/api` | HTTP API, auth, learning data, written assistant, admin reporting |
| `apps/web` | Installable React PWA, offline packs, all consoles |
| `packages/shared` | Types, language table, safety filters, scam detector |
| `content` | Source of truth for paths, lessons, strings, examples, fixtures |
| `scripts` | Seed, content pipeline, evaluations, security checks |

## Data model

`apps/api/src/db-types.ts` defines the stored shape. The important decisions:

- `DbUser` keeps `phoneEnc` (AES-256-GCM), `phoneHash` (HMAC-SHA256, used for lookup) and `phoneMasked` (display only). No raw phone number is ever stored.
- `DbOtp` keeps `codeHash` only, with `attempts`, `expiresAt` and `lockedUntil`.
- `DbRefreshToken` keeps a SHA-256 hash of the token, never the token itself.
- `DbTranslation` is one row per `(key, lang)` with a review status, so a language can be partially live.
- `DbProgress` is per `(user, lesson)` with the furthest step, completion time and a stuck counter.

`Store` is a small repository over that shape. It writes atomically (temp file +
rename) and debounces saves by 30 ms. Every write path goes through it, which is
the seam to swap for a SQL repository.

## Content pipeline

`content/*.json` is the source. `apps/api/src/seed.ts` reads it at boot (or on
`npm run seed`) and produces `paths`, `lessons`, `translations`,
`scamExamples` and `glossary`. English lesson text is authoritative and inline in
`lessons.json`; translations may also be supplied inline (`titleTexts`,
`texts`, `checkTexts`) or edited in the admin console, which writes to
`translations`.

`apps/api/src/content-service.ts` resolves a string for a language:

1. an `approved` translation, or a `needs_review`/`machine` one while pilot mode is on;
2. otherwise the English string, marked `fallback`;
3. otherwise the key itself, marked `missing`.

Every lesson step therefore carries `fallback` and `status`, and the UI shows a
translation notice when anything fell back.

## Auth and roles

- Learners sign in with a phone number and a 6-digit OTP (5-minute expiry, 60-second resend cooldown, lockout after 5 wrong tries).
- Staff, family members and admins sign in with email and a bcrypt password (lockout after 5 failures).
- Access tokens are 30-minute JWTs; refresh tokens are opaque, hashed at rest, rotated on use and revoked on logout.
- Roles are enforced per route (`requireRole`) and per record: a facilitator only reaches learners in their own groups, a family member only learners who accepted their link.

## Assistant pipeline

`POST /assistant/turn` accepts typed text only. There is no speech-to-text, no
text-to-speech and no audio upload anywhere in the app. The assistant runs a
fixed order of guards before any language model is consulted:

1. **Crisis detection** — money sent, credential shared, self-harm, abuse, medical emergency, distress.
2. **Secret handling** — anything that looks like an attempt to share or obtain a credential is refused, and the text is dropped.
3. **AI disclosure** — "are you a human?" gets an honest answer.
4. **Advice boundary** — medical, legal and money questions are redirected.
5. **Confidence** — a reply the assistant is unsure of asks the learner to confirm before acting.
6. **Answer** — retrieval over lessons and glossary plus the mock answer bank, or the configured LLM with the same system prompt.

The reply is sanitised again on the way out. Every exchange records a prompt
version, language, confidence, flag and latency — never the typed question,
unless the learner consented to transcript storage.

## Scam detector

`packages/shared/src/scam.ts` is a weighted rule set with an explicit
safety invariant: a message that asks the reader to send or say a credential is
always a scam, while a message that warns against sharing one is never treated
as a request. `npm run scam:eval` enforces that invariant and a 90% accuracy
floor against `content/scam-eval.json`.

## Help-request triage

`apps/api/src/triage.ts` asks [Nace Drex](https://console.nace.ai/docs/drex)
who should pick up a help request and how soon, in a single `POST
/v1/systemone` call. Two `choice` questions (route, priority) and one `noul`
(enough urgency to act today) are answered together, and each comes back with a
probability distribution rather than a single label, so SABI can refuse to route
when the options are close: below 0.5 the local rule set decides instead, and an
urgency probability above 0.6 overrides a hesitant priority answer.

Only a compact case state leaves the API — request type, language and lesson
slug. Names, phone numbers and free-form learner text never do.

Drex is never on the critical path. With no `NACE_API_KEY`, on any non-200, on
unreadable JSON or after eight seconds it falls back to the local rules
(`call_back` → facilitator now, `whatsapp` → family soon) and records
`source: "local"`, so the learner is always told someone is coming. The
decision is stored on the request and shown to facilitators, who can see why it
reached them.

## Offline strategy

- The service worker caches the app shell and public API responses; authenticated traffic always goes to the network.
- Lesson bundles (`GET /lessons/:slug/bundle`) are stored in `localStorage` with their UI strings, so a downloaded lesson renders with no network.
- Progress is written locally first, queued in an outbox and reconciled with `POST /progress/sync`, which only accepts rows newer than what the server has. Steps never move backwards.

## Privacy and retention

| Data | Default |
| --- | --- |
| Typed questions | not stored unless the learner consents |
| Account data | exportable (`GET /me/export`) and deletable (`DELETE /me`) by the learner |
| Demo data | development only, gitignored |

## Scaling beyond the pilot

The JSON store is deliberately dependency-free. To scale:

1. Implement the `Store` surface over PostgreSQL (the `datasource` seam is one class).
2. Replace the in-process rate-limit maps with Redis if more than one instance runs.
3. Keep the API as the only writer so `progress/sync` remains the single reconciliation point.
