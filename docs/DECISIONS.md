# Decisions

Architecture and product decisions, newest first. Each entry records the
context, the decision and its consequences so a later maintainer can tell a
deliberate trade-off from an accident.

Status values: **Accepted**, **Superseded**, **Proposed**.

---

## D-014 — Ship as a text-first assistant, not a voice assistant

**Date:** 2026-11-23 · **Status:** Accepted · **Supersedes:** the voice-first
requirement in `05-VOICE-CHATBOT.md`

**Context.** The build kit asks for a voice-first assistant. A voice product
needs speech-to-text and text-to-speech for Yorùbá, Igbo, Pidgin and Nigerian
English, audio storage and retention rules, and a microphone permission flow.
None of those providers were available, and audio recording is the highest-risk
data the app could hold.

**Decision.** The assistant is written only. `/ask` and
`POST /api/v1/assistant/turn` accept typed text, and the reply is displayed in
writing in the learner's language. There is no microphone access, no audio
upload, no speech endpoint, no TTS cache and no audio retention. The speech
routes and their assets were removed, and the test suite asserts that they stay
gone (`apps/api/test/assistant.test.ts`, `scripts/security-check.ts`).

**Consequences.**

- The spec's voice-first acceptance criteria are not met. This is a documented
  product deviation, not an unfinished feature.
- The privacy story is simpler: no recordings exist, so there is nothing to
  retain or delete.
- A future voice release needs a separate decision, real provider evaluation for
  each language, a microphone consent flow and a retention design before any
  audio is accepted.

---

## D-013 — Use Nace Drex for help-request triage, with a local fallback

**Date:** 2026-11-24 · **Status:** Accepted

**Context.** A help request ("call me back", "message me on WhatsApp") has to
reach the right person quickly. A rules-only router is predictable but ignores
context; a model-only router can stall a learner.

**Decision.** `POST /help-requests` sends a compact, non-identifying case state
(request type, language, lesson slug) and three typed questions to the Nace Drex
API (`POST https://console.nace.ai/v1/systemone`, model `drex-latest`). The
response gives probability distributions for route (`facilitator`, `family`,
`support`) and priority (`now`, `soon`, `whenever`), plus an urgency probability.

- A top route below `0.5` is treated as uncertain and the local rules decide.
- Urgency above `0.6` promotes the priority to `now`.
- Any non-200, timeout (8 s), unreadable body or missing `NACE_API_KEY` falls
  back to the local rules in `apps/api/src/triage.ts`.
- The decision and its `source` (`drex` or `local`) are stored on the request
  and shown to facilitators.

**Consequences.**

- Drex is never on the critical path; the learner always gets a 201.
- The app works with no key. `NACE_API_KEY` is optional.
- The key supplied during the build was rejected by Nace with HTTP 401
  (`Invalid API key`). It is recorded but disabled in `.env`; triage therefore
  reports `source: "local"` until a valid key is installed.

---

## D-012 — `APP_NAME` is the only place the product name is written

**Date:** 2026-11-23 · **Status:** Accepted

**Context.** The owner will rename the product. A name scattered through copy,
certificates, SMS templates and the manifest is expensive to change and easy to
miss.

**Decision.** `packages/shared/src/config.ts` exports `APP_NAME`, read from
`APP_NAME` (API) or `VITE_APP_NAME` (web), defaulting to `SABI`. UI strings use
the `{{app}}` placeholder; `t()`/`tf()` in `apps/web/src/lib/i18n.tsx`
interpolate it. The API uses `env.appName` for SMS and exports.

**Consequences.**

- Renaming is an environment change plus a reseed, not a code search.
- New copy must use `{{app}}`, never a literal name. `scripts/security-check.ts`
  and review catch regressions.
- `APP_NAME` and `VITE_APP_NAME` must agree; `.env.example` sets both.

---

## D-011 — Serve the API and the built PWA from one process

**Date:** 2026-11-22 · **Status:** Accepted

**Context.** A service worker, an installable manifest and SPA routes behave
differently when the API and the shell live on different origins.

**Decision.** The Express app serves `apps/web/dist` when it exists, with an SPA
fallback for non-`/api` routes. The web build defaults to the relative
`VITE_API_BASE=/api/v1`. Separate hosting remains possible by setting an
absolute `VITE_API_BASE` and adding the web origin to `WEB_ORIGIN`.

**Consequences.**

- Production is one container, one origin, one health check.
- CORS is only needed for split hosting and local development; the allow-list is
  exact, never a wildcard.
- Static assets and API share a process, so a crash takes both down. The
  health check and restart policy cover this.

---

## D-010 — Keep the dependency-free JSON store for the pilot

**Date:** 2026-11-22 · **Status:** Accepted · **Superseded by:** a Postgres
repository before multi-instance production

**Context.** The spec names PostgreSQL and Redis. A pilot needs to run with
`npm install` and no services, and the data volume is tiny (dozens of learners).

**Decision.** `apps/api/src/store.ts` is a repository over one JSON document,
written atomically (temp file + rename) and debounced by 30 ms. Every read and
write goes through `Store`, which is the seam for a SQL implementation.
Rate-limit counters are in-process maps.

**Consequences.**

- Local setup has no external dependency; backup is a file copy.
- The store is single-writer and single-instance. It is not suitable for
  horizontal scaling or high write volume.
- Moving to Postgres means implementing the `Store` surface and replacing the
  in-process rate-limit maps with Redis; routes and tests should not change.
- `DATABASE_FILE` must point at a persistent volume in production.

---

## D-009 — Partial translations are allowed, but never silently

**Date:** 2026-11-22 · **Status:** Accepted

**Context.** Yorùbá, Igbo and Pidgin cannot be fully reviewed before a pilot,
and machine output is not trustworthy enough to present as final.

**Decision.** Every string is a row per `(key, lang)` with a status: `draft`,
`machine`, `needs_review` or `approved`. English is authoritative. With
`ALLOW_UNREVIEWED_TRANSLATIONS=true`, reviewed-but-not-approved strings are
served with a visible notice; anything missing falls back to English with the
same notice. In production the flag should be `false`, so only approved strings
are served.

**Consequences.**

- The app is usable in all four languages from day one.
- Native-speaker review is a release task, not a code task. Current coverage is
  reported by `npm run content:status` and in the admin Translations tab.
- The notice is part of the design, not a debug message; it must not be removed
  to make screenshots look cleaner.

---

## D-008 — The scam checker is a rule set with a hard safety invariant

**Date:** 2026-11-22 · **Status:** Accepted

**Context.** A language model can be persuasive and wrong about a scam. Calling
a credential request "safe" is the most damaging failure the product can have.

**Decision.** `packages/shared/src/scam.ts` is a weighted rule set. Two rules are
absolute:

1. A message that asks the reader to send, say or reply with a PIN, OTP,
   password, BVN, NIN or card detail is always a scam.
2. A message that warns the reader never to share one is never treated as a
   request.

Verdicts are hedged (`scam`, `unsure`, `safe`) and always carry reasons and next
steps. `npm run scam:eval` runs 46 fixtures and fails on any unsafe "safe"
verdict or below 90% accuracy.

**Consequences.**

- Behaviour is explainable and testable; no provider dependency.
- New scam patterns need new rules and fixtures, not prompt tuning.
- The eval is a release gate in `npm run verify` and CI.

---

## D-007 — The assistant refuses secrets and routes crises before answering

**Date:** 2026-11-22 · **Status:** Accepted

**Context.** Older learners may paste an OTP or ask for medical, legal or money
advice. The assistant must not become a channel for secrets or unlicensed advice.

**Decision.** `POST /assistant/turn` runs a fixed guard order before any model:
crisis detection, secret handling, AI disclosure, advice boundary, confidence,
then the answer. A prompt containing a credential is refused and not stored.
Replies are sanitised on the way out. The AI disclosure is always visible in the
shell.

**Consequences.**

- Some legitimate questions are deflected; that is the intended trade-off.
- The model is optional: the mock answer bank and retrieval path work offline
  and in tests.
- Safety behaviour is covered by `npm run assistant:eval` (50 cases) and API
  tests, not by the language model's own judgement.

---

## D-006 — Phone-first learner auth, email for staff

**Date:** 2026-11-22 · **Status:** Accepted

**Context.** Many learners do not use email. Staff and family members do.

**Decision.** Learners sign in with a Nigerian phone number and a 6-digit OTP
(5-minute expiry, 60-second resend cooldown, lockout after 5 wrong tries). Staff,
family members and admins use email and bcrypt passwords. Access tokens are
30-minute JWTs; refresh tokens are opaque, hashed at rest, rotated on use and
revoked on logout.

**Consequences.**

- No password to forget for the main audience.
- SMS delivery is a real dependency in production; the mock provider echoes the
  code only outside production.
- Phone numbers are stored as AES-256-GCM ciphertext plus an HMAC lookup hash
  and a display mask; the raw number is never stored.

---

## D-005 — One monorepo with a shared safety package

**Date:** 2026-11-21 · **Status:** Accepted

**Context.** The web app, API and tests all need the same language list, types,
scam rules and safety filters. Duplicating them invites drift.

**Decision.** npm workspaces: `apps/web`, `apps/api`, `packages/shared`,
`content`, `scripts`, `docs`. `packages/shared` owns types, languages, safety
filters, the scam detector and `APP_NAME`. Content JSON is the source of truth
and is seeded into the store.

**Consequences.**

- One `npm install`, one `npm run verify`.
- Shared code must stay free of Node-only or browser-only imports.
- Content changes go through `content:validate`, not direct database edits.

---

## D-004 — No placeholders, no demo data outside the seed

**Date:** 2026-11-21 · **Status:** Accepted

**Context.** Placeholder screens and hard-coded sample data make a demo look
finished while hiding missing work.

**Decision.** Every route in `apps/web/src/App.tsx` renders a real screen.
Demo users, groups, progress and examples exist only in `apps/api/src/seed.ts`
and `content/`. Empty states are explicit. The production build never seeds demo
accounts implicitly.

**Consequences.**

- Reviewers can trust what they see.
- A new screen needs content, states, tests and translations before it ships.

---

## D-003 — Black-and-white design with large targets

**Date:** 2026-11-21 · **Status:** Accepted

**Context.** The audience includes low-vision users and first-time smartphone
users. Colour, small text and dense layouts are barriers.

**Decision.** The palette is black on white with an inverted option. Atkinson
Hyperlegible is self-hosted. The minimum touch target is 3.5 rem. Three text
sizes, reduced motion, visible focus and plain-language copy are built in.
Diacritics are tested at `/dev/typography`.

**Consequences.**

- Some visual richness is sacrificed for legibility.
- New components must use the design tokens, not ad-hoc colours or sizes.
- Accessibility is checked per screen; a formal WCAG 2.2 AA audit is still a
  human task.

---

## D-002 — English content is authoritative; translations are overlays

**Date:** 2026-11-21 · **Status:** Accepted

**Context.** Lesson structure must not fork per language, or fixes would have to
be made four times.

**Decision.** `content/lessons.json` holds the canonical English lesson, steps,
checks and visual descriptors. Translations are overlays keyed by string key or
lesson field. Missing translations fall back to English and are marked.

**Consequences.**

- One curriculum, four presentations.
- Translators work against stable keys.
- A structural change is made once and re-translated.

---

## D-001 — Build the pilot before the platform

**Date:** 2026-11-21 · **Status:** Accepted

**Context.** The kit describes a production platform (Postgres, Redis, Prisma,
voice, multi-service Docker). Building all of it before learning whether the
curriculum works would delay the pilot indefinitely.

**Decision.** Ship a complete, honest pilot: real screens, real auth, real
content, real safety behaviour, one-process deployment, JSON storage, mock
providers by default. Record every deviation here and in
`docs/HANDOVER.md`.

**Consequences.**

- The pilot can run today on one machine or one container.
- Postgres, Redis, real SMS/LLM keys and native-speaker review are explicit
  pre-production tasks, not hidden assumptions.
