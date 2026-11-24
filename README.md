# SABI

**Learn phones and the internet, safely, in your own language.**

SABI is a digital literacy platform for older adults in Nigeria. It teaches the
everyday things people actually need — switching a phone on, making a call,
sending a WhatsApp voice note, checking a balance, spotting a scam — in English,
Yorùbá, Igbo and Nigerian Pidgin, with large readable text and a practice sandbox
that never touches real money.

- **40 lessons** across **6 goal-based paths**
- **4 languages**, with a visible notice whenever a translation is still under review
- **Scam checker** that is always suspicious of anyone asking for a PIN, OTP, password, BVN or card
- **Written assistant** with crisis routing, AI disclosure and hard refusal to handle secrets
- **Offline packs** so a lesson keeps working without data
- **Facilitator, family and admin** consoles

## Quick start

```bash
npm install
npm run seed        # demo data + accounts (writes apps/api/data/db.json)
npm run dev         # API on :4100, web on :5173
```

Open <http://localhost:5173>. The API prints the OTP codes to its console and the
learner sign-in screen shows them while the mock SMS provider is active.

Requirements: Node.js 20 or newer (developed on Node 22/26), npm 10+.

### Demo accounts

| Role | How to sign in |
| --- | --- |
| Learner | any of `08030000001` … `08030000006`, then the 6-digit code shown in the app |
| Facilitator | `facilitator@sabi.app` / `Teach123!` |
| Family member | `family@sabi.app` / `Family123!` |
| Administrator | `admin@sabi.app` / `Admin123!` |

These accounts exist only in development seed data. `npm run seed` recreates them.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API (tsx watch) and web (Vite) together |
| `npm run build` | Type-check and build the PWA into `apps/web/dist` |
| `npm start` | Run the API; it also serves the built PWA if `apps/web/dist` exists |
| `npm test` | API end-to-end tests, then web unit tests |
| `npm run typecheck` | Strict TypeScript across both apps |
| `npm run verify` | Typecheck, all tests, content validation, both evaluations, security checks, build |
| `npm run seed` | Reset the local database to the demo seed |
| `npm run content:build` | Refresh content tables from `content/` without touching learner data |
| `npm run content:validate` | Structural validation of `content/` |
| `npm run content:status` | Translation and lesson coverage report |
| `npm run scam:eval` | Score the scam detector against `content/scam-eval.json` |
| `npm run assistant:eval` | Score the assistant against `content/assistant-safety-tests.json` |
| `npm run security:check` | Static checks for the privacy promises below |

## How it is put together

```
apps/api       Express + TypeScript API, JSON store (Postgres is the production target)
apps/web       React + Vite PWA (installable, offline packs, service worker)
packages/shared  Types, languages, safety filters and the scam detector
content/       Paths, lessons, UI strings, scam examples, evaluation fixtures
scripts/       Seed, content tooling, evaluations and security checks
```

The API can serve the built PWA itself, so production is one process and one
origin. The static web build can also be hosted separately (for example on
Vercel) by pointing `VITE_API_BASE` at the API's absolute URL and adding the web
origin to `WEB_ORIGIN`. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

### API at a glance

All routes live under `/api/v1`.

| Area | Routes |
| --- | --- |
| Public | `GET /health`, `GET /config`, `GET /paths`, `GET /ui-strings/:lang` |
| Auth | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| Learner | `GET/PATCH/DELETE /me`, `GET /me/export`, `GET/POST /me/consents`, `GET /progress`, `PUT /progress/:lesson`, `POST /progress/sync`, `POST /sandbox/attempts` |
| Content | `GET /paths/:slug`, `GET /lessons/:slug`, `GET /lessons/:slug/bundle` |
| Assistant | `POST /assistant/turn`, `POST /scam/check`, `GET /scam/examples` |
| People | `POST/GET/PATCH /help-requests` (routed by Nace Drex, or local rules without a key), `GET/POST /groups`, `POST /groups/:id/members`, `POST /groups/:id/import`, `GET /groups/:id/progress`, `POST /groups/:id/notes`, family link routes, `GET/PUT /reminders` |
| Admin | `GET/PATCH /admin/translations`, `GET /admin/analytics`, `GET /admin/audit-logs`, `GET /admin/users`, scam example routes, `GET /admin/glossary` |

## Safety and privacy design

These are enforced in code, not only in copy:

- **Secrets never reach the assistant.** Any prompt containing a PIN, OTP, password, BVN, NIN or card detail is refused and never stored; replies that echo or request one are replaced with a warning.
- **Crisis first.** Mentions of money already sent, a shared credential, self-harm, abuse or a medical emergency are routed to a calm, specific response that points to a bank, a trusted person or emergency help.
- **No advice.** Medical, legal and money questions are redirected to a professional.
- **Scam directions matter.** "Send your OTP" is a scam; "never share your OTP" is safe. The detector is tested against 46 fixtures and fails the build if any scam or credential request is called safe.
- **Phones are encrypted and hashed.** Accounts store an AES-256-GCM ciphertext, an HMAC lookup hash and a display mask — never the raw number.
- **Learner choice is explicit.** Typed questions are only stored with consent, and a learner can export or delete their account from the app.
- **Text only.** There is no microphone, no audio upload and no speech API anywhere in the app.
- **Rate limits** apply to OTP requests, staff logins and assistant questions.

## Accessibility

Atkinson Hyperlegible throughout, a 3.5rem minimum touch target, a high-contrast
inverted theme, three text sizes, reduced-motion support, plain-language copy
and screen-reader alt text for every lesson step.

## Known limitations

- The JSON file store is for development and single-instance pilots. Postgres is the production target.
- Provider adapters default to mocks. Real language-model and SMS calls need keys in `.env`.
- Yorùbá, Igbo and Pidgin UI strings are partly translated; untranslated keys fall back to English with a notice while `ALLOW_UNREVIEWED_TRANSLATIONS=true`. Run `npm run content:status` for current coverage.
- Answer quality for these languages still needs review by native speakers; the evaluation in `scripts/assistant-eval.ts` covers safety behaviour only.

## License

Private and unlicensed unless agreed otherwise with the owner.
