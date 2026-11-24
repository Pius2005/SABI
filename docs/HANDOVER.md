# Handover

This is the operating handover for the SABI pilot. It states what exists, how to
run and verify it, what was deliberately not built, and the human actions that
must happen before real learners use it.

## 1. What this is

SABI is an installable, text-first digital literacy PWA for older adults in
Nigeria. It teaches phone, WhatsApp, banking, scam-awareness and everyday-service
skills in English, Yorùbá, Igbo and Nigerian Pidgin, with large text, large touch
targets, a black-and-white design and a practice sandbox that never touches real
money.

Shipped:

- 6 learning paths, 40 lessons, 148 steps, 327 English UI strings.
- Learner, facilitator, family and admin experiences, all backed by the real API.
- Phone + OTP learner sign-in; email + password for staff, family and admin.
- Written assistant with crisis routing, secret refusal, AI disclosure and
  advice boundaries.
- Scam checker with 46 evaluation fixtures and a hard credential-request
  invariant.
- Offline lesson bundles, a progress outbox and a sync endpoint.
- Translation workflow with per-string review status and a visible notice.
- Help-request triage through Nace Drex, with a local fallback.
- Admin analytics, translations, scam examples, audit log, people and glossary.
- Docker image, CI workflow and a one-command verification suite.

Deliberate deviation: **the assistant is text-only, not voice-first.** See
`docs/DECISIONS.md` D-014. There is no microphone, audio upload, speech endpoint
or audio retention anywhere in the product.

## 2. Run it

Requirements: Node.js 20+ (developed on Node 22/26), npm 10+.

```bash
npm install
npm run seed        # demo data + accounts -> apps/api/data/db.json
npm run dev         # API :4100, web :5173
```

Open <http://localhost:5173>. With the mock SMS provider, the learner sign-in
screen shows the OTP and the API prints it to its console.

Single-process production shape:

```bash
npm run verify      # typecheck, tests, content, evaluations, security, build
npm start           # API :4100 serves apps/web/dist
```

### Demo accounts (development seed only)

| Role | Sign in |
| --- | --- |
| Learner | `08030000001` … `08030000006`, then the code shown in the app |
| Facilitator | `facilitator@sabi.app` / `Teach123!` |
| Family | `family@sabi.app` / `Family123!` |
| Admin | `admin@sabi.app` / `Admin123!` |

`npm run seed` recreates them. They are not created implicitly in production.

## 3. Configuration

Copy `.env.example` to `.env`. Everything has a safe local default except real
provider keys.

| Variable | Purpose | Production note |
| --- | --- | --- |
| `APP_NAME`, `VITE_APP_NAME` | Product name; must match | Change both together |
| `NODE_ENV` | Runtime mode | `production` |
| `PORT` | API port | Platform value |
| `WEB_ORIGIN` | Allowed browser origins, comma-separated | Exact HTTPS origin(s) |
| `DATABASE_FILE` | JSON store path | Absolute path on a persistent volume |
| `JWT_ACCESS_SECRET` | Access-token signing key | 32+ random characters |
| `JWT_REFRESH_SECRET` | Refresh-token signing key | 32+ random characters |
| `ENCRYPTION_KEY` | Phone encryption key | 32+ random characters; changing it makes stored phones unreadable |
| `LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_BASE_URL` | Written answers | `mock` without a key |
| `SMS_PROVIDER`, `SMS_API_KEY`, `SMS_SENDER_ID` | OTP delivery | `mock` without a key |
| `WHATSAPP_PROVIDER`, `WHATSAPP_API_KEY` | Family encouragement | `mock` without a key |
| `NACE_API_KEY` | Drex help-request triage | Optional; local rules without it |
| `TRANSCRIPT_RETENTION_DAYS` | Retention when consent is given | 30 |
| `ALLOW_UNREVIEWED_TRANSLATIONS` | Serve `needs_review` strings with a notice | `false` once reviewed |
| `CONF_THRESHOLD`, `DEFAULT_LANGUAGE` | Assistant confidence floor, default language | 0.6, `en` |

Generate secrets without putting them in shell history:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`.env` is gitignored. `npm run security:check` fails if it becomes tracked or if
a provider secret is hard-coded in source.

## 4. Verification status

Last full run on this machine:

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | Pass — 73 API tests, 16 web tests (89 total) |
| `npm run content:validate` | Pass — 6 paths, 40 lessons, 148 steps, 327 English strings, 20 scam examples, 30 glossary terms; warnings for untranslated yo/ig/pcm |
| `npm run scam:eval` | Pass — 46/46 (100%) |
| `npm run assistant:eval` | Pass — 50/50 |
| `npm run security:check` | Pass — 27/27 |
| `npm run build` | Pass — chunk-size warning only |
| Browser smoke test | Pass — Welcome, Home, Ask, Scam, Me, Family, Facilitator, Admin (all tabs), Goals, Setup, Offline, Privacy, Certificate lock state |
| `docker build` | Not run on this machine |
| Playwright / Lighthouse / axe | Not configured |

The build emits one warning: the main JS chunk is about 893 kB (186 kB gzip).
It is a single-page app with all screens eagerly imported; route-level lazy
loading would remove the warning but is not required for the pilot.

## 5. Human actions before real learners

These cannot be completed by code alone.

1. **Replace the Nace key.** The key supplied during the build was rejected by
   Nace with HTTP 401 `Invalid API key`. It is disabled in `.env` (commented out)
   so triage uses the local rules and does not wait on a failing call. Install a
   valid `NACE_API_KEY` and confirm `triage.source` becomes `"drex"`. Until then
   the app works correctly with `source: "local"`.
2. **Native-speaker review of Yorùbá, Igbo and Pidgin.** Current coverage is
   partial: `npm run content:status` reports the exact counts. Approve strings in
   the admin Translations tab. Do not set
   `ALLOW_UNREVIEWED_TRANSLATIONS=false` until review is complete, or learners
   will see English fallbacks.
3. **Configure real providers.** Set `SMS_PROVIDER=termii` and
   `SMS_API_KEY` for OTPs; set `LLM_PROVIDER=openai` and `LLM_API_KEY` for
   generated answers. Test both with a small group before the pilot. With mock
   providers the OTP is visible and answers come from the local bank.
4. **Replace the JSON store for multi-instance production.** The JSON store is
   single-writer. For one pilot instance it is fine; for anything larger,
   implement the `Store` surface over PostgreSQL and move rate limits to Redis
   (`docs/ARCHITECTURE.md`, "Scaling beyond the pilot").
5. **Set production secrets and origins.** Replace all `dev-*` defaults, set
   `NODE_ENV=production`, set the exact HTTPS `WEB_ORIGIN`, and confirm
   `GET /api/v1/config` reports `demo: false` and the expected providers.
6. **Independent security and accessibility review.** `npm run security:check`
   is a static self-check, not a penetration test. A WCAG 2.2 AA audit with
   assistive technology and older users is still required; the design targets
   AA but has not been externally certified.
7. **Pilot protocol and consent.** Agree the facilitator script, the support
   phone number, the escalation path and the data-retention period with the
   owner. Confirm the privacy notice and terms with a Nigerian lawyer.
8. **Backups and monitoring.** Put `DATABASE_FILE` on a backed-up volume, watch
   `GET /api/v1/health`, and collect the admin analytics weekly.

## 6. Known gaps

- **No Playwright/E2E suite.** The browser smoke test was run manually through
  the in-app browser. Add Playwright before a larger release.
- **No ESLint/Prettier configuration.** TypeScript strict mode and tests are the
  current quality gates. Add lint before accepting outside contributions.
- **No Husky pre-commit hook.** CI is the gate instead.
- **No Prisma/PostgreSQL migration.** The JSON store is intentional for the
  pilot; the repository seam is in place.
- **Docker Compose is single-service.** It runs the app with a data volume. The
  spec's separate `web`, `api`, `postgres` and `redis` services do not exist
  because the app is one process and has no database service yet.
- **`npm audit` has not been re-run recently.** Run it and review before
  production.
- **Voice-first requirements from spec file 05 are not met.** Documented in
  `docs/DECISIONS.md` D-014.

## 7. Where things live

| Path | What |
| --- | --- |
| `apps/api/src/routes/` | Every endpoint |
| `apps/api/src/assistant/answer.ts` | Guard order and answer pipeline |
| `apps/api/src/triage.ts` | Drex call and local fallback |
| `apps/api/src/store.ts` | JSON repository and atomic writes |
| `apps/web/src/screens/` | Every screen, including `/ask` |
| `apps/web/src/lib/i18n.tsx` | Translation loading, `{{app}}` interpolation |
| `packages/shared/src/scam.ts` | Scam rules and safety invariant |
| `packages/shared/src/safety.ts` | Secret and crisis detection |
| `content/` | Paths, lessons, strings, examples, fixtures |
| `scripts/` | Seed, content tooling, evaluations, security checks |
| `docs/` | Architecture, decisions, API, deployment, security, incidents |

## 8. First week as maintainer

1. `npm ci && npm run verify` — confirm the baseline.
2. `npm run seed && npm run dev` — sign in as each demo role.
3. Read `docs/DECISIONS.md` and `docs/SECURITY_CHECKLIST.md`.
4. Run `npm run content:status` and open the admin Translations tab.
5. Replace the Nace key and confirm `source: "drex"` on a help request.
6. Set up the production volume, secrets and HTTPS origin.
7. Run a facilitator-led session with 3–5 learners and record where they get
   stuck. That feedback is worth more than another feature.

## 9. Support and escalation

- Product and content owner: _to be named by the client_.
- Technical maintainer: _to be named by the client_.
- Safeguarding lead for crisis or abuse reports: _to be named before the pilot_.
- Incident handling: `docs/INCIDENT_RESPONSE.md`.
- Security checklist: `docs/SECURITY_CHECKLIST.md`.
