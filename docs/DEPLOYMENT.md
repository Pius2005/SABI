# Deployment

The API serves the built PWA, so production is one process on one origin.

## 1. Build

```bash
npm ci
npm run verify        # typecheck, tests, content validation, evaluations, build
```

`npm run verify` writes `apps/web/dist`. `npm start` serves that directory,
including the SPA fallback for client-side routes.

## 2. Configure

Copy `.env.example` to `.env` (or set real environment variables) and set at
least:

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `4100` (or whatever the platform injects) |
| `WEB_ORIGIN` | the public HTTPS origin, e.g. `https://sabi.example.com` |
| `DATABASE_FILE` | an absolute path on a persistent volume |
| `JWT_ACCESS_SECRET` | 32+ random characters |
| `JWT_REFRESH_SECRET` | 32+ random characters |
| `ENCRYPTION_KEY` | 32+ random characters — changing it makes stored phones unreadable |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | the first administrator, created only on an empty database (12+ character password) |
| `ALLOW_UNREVIEWED_TRANSLATIONS` | `false` once translations are approved |

A production database is seeded with lesson content only. The demo staff and
learner accounts in the README exist in development seed data and are never
created when `NODE_ENV=production`; without `ADMIN_EMAIL`/`ADMIN_PASSWORD` there
is no way to sign in as staff. The API refuses to start in production with the
`dev-*` secret defaults or with secrets shorter than 32 characters.

Provider keys (`LLM_API_KEY`, `SMS_API_KEY`) are optional; without them the app
runs on mock providers, which is fine for a demo and wrong for real learners.

Generate secrets without writing them to a shell history:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 3. Run

```bash
NODE_ENV=production npm start
```

Health check: `GET /api/v1/health` returns `{"ok":true,...}`.

### Docker

```bash
# The Dockerfile lives in deploy/ so Vercel does not treat the repository as a
# container service when it builds the static web app.
docker build -f deploy/Dockerfile -t sabi .
docker run -p 4100:4100 --env-file .env -v sabi-data:/app/apps/api/data sabi
```

The image installs dev dependencies so it can run `npm run build` at build time,
then sets `NODE_ENV=production` and runs `npm start` as the `node` user. Mount a
volume at `/app/apps/api/data` (or set `DATABASE_FILE` to a path on one) and pass
`ADMIN_EMAIL`/`ADMIN_PASSWORD` on the first boot so the database gets an admin.

## 4. Reverse proxy and TLS

Terminate TLS in front of the app (nginx, Caddy, or the platform's own proxy).
The app only needs plain HTTP on `PORT`. Forward the original `Host` and serve
the whole origin to the app so the service worker and SPA fallback keep working.

Example nginx location:

```nginx
location / {
  proxy_pass http://127.0.0.1:4100;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 5. Static frontend on another host (e.g. Vercel)

`apps/web` builds to static files, so it can be hosted away from the API. The
API itself still needs a long-running Node process with a persistent
`DATABASE_FILE` — it does not run on Vercel's serverless filesystem.

1. Build the web app with the API's public URL baked in:

   ```bash
   VITE_API_BASE=https://api.example.com/api/v1 npm run build
   ```

   The browser then calls that origin directly; with the default `/api/v1` it
   calls the host that served the page. On Vercel the value must be a **project
   environment variable** (`vercel env add VITE_API_BASE production`, or the
   dashboard) so every build picks it up — passing it only to a single
   `vercel deploy --build-env` run does not persist. If it is missing, the SPA
   rewrite answers `/api/v1/...` with `index.html` and a 200, so the app looks
   connected while no request ever reaches the API.

2. On the API, set `WEB_ORIGIN` to the frontend origin. It accepts a
   comma-separated list, so preview and production domains can coexist:

   ```bash
   WEB_ORIGIN=https://sabi.vercel.app,https://sabi.example.com
   ```

   Any other `Origin` is rejected with 403, which the app shows as
   "Origin not allowed." Keep the list exact — wildcards and preview URLs are
   not accepted, so add each preview domain you need to test.

3. Serve the build as an SPA (all routes to `index.html`). Tokens live in
   `localStorage` on the web origin and are sent as `Authorization: Bearer`, so
   no cookies or cross-site credential flags are involved.

### Render blueprint

`render.yaml` describes the free-plan API service that is deployed today:
Node runtime, Frankfurt, no disk, and
`DATABASE_FILE=/opt/render/project/src/apps/api/data/db.json`. Create it from the
Render dashboard with **New → Blueprint** and pick this repository; Render
prompts for the `sync: false` values on the first deploy.

A free instance has **no persistent disk**: the JSON store lives on the instance
filesystem, so every deploy and every restart starts empty, and the instance
sleeps after about 15 minutes idle (~50 s on the next request). Deploying is
cheap and repeatable, which is why it suits a demo; it is not a pilot setup.

The paid upgrade (Starter plan, needs a card at dashboard.render.com/billing)
keeps data across deploys:

```yaml
    plan: starter
    envVars:
      - key: DATABASE_FILE
        value: /var/data/sabi.json
    disk:
      name: sabi-data
      mountPath: /var/data
      sizeGB: 1
```

Because the free store is erased on each deploy, `ADMIN_EMAIL` and
`ADMIN_PASSWORD` take effect on the next deploy: add them, deploy, and the
administrator is created on the empty store. On the paid plan they are used
once, on the first boot of an empty volume.

Set these in the dashboard:

| Variable | Value |
| --- | --- |
| `WEB_ORIGIN` | the frontend origin(s), comma-separated, no wildcards |
| `ADMIN_EMAIL` | the owner's sign-in email |
| `ADMIN_PASSWORD` | at least 12 characters |
| `LLM_API_KEY` | only when `LLM_PROVIDER=openai` |
| `SMS_API_KEY` | only when `SMS_PROVIDER` is `termii` or `sendchamp` |
| `SMS_CHANNEL` | `dnd` (default) for OTPs; `generic` only without DND activation |
| `SMS_SENDER_ID` | an approved sender ID (3–11 characters) |
| `NACE_API_KEY` | optional, enables Nace Drex triage |

`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and `ENCRYPTION_KEY` are generated by
Render. Changing them invalidates every session and makes stored phone numbers
unreadable, so keep them once the pilot data matters.

With `SMS_PROVIDER=mock` in production the OTP is never returned to the client
and never sent, so learners cannot sign in with a phone number; staff accounts
still work with email and password. Add a Termii or Sendchamp key before
piloting with learners.

### Real SMS delivery

Two gateways are implemented behind `SMS_PROVIDER`. Both receive the number in
MSISDN form, and both failures surface as the same `502 SMS_FAILED` response
with the code dropped, so switching is a variable change only.

| | Termii | Sendchamp |
| --- | --- | --- |
| Free starting point | free test credit | 50 free SMS units |
| Endpoint | `api.ng.termii.com/api/sms/send` | `api.sendchamp.com/api/v1/sms/send` |
| Route values | `dnd` / `generic` | `dnd` / `non_dnd` |
| Startup variables | `SMS_PROVIDER=termii` | `SMS_PROVIDER=sendchamp` |

OTP delivery needs three values together, and the service warns at startup when
they are missing:

```bash
SMS_PROVIDER=termii        # or sendchamp
SMS_API_KEY=<key from the provider dashboard>
SMS_SENDER_ID=<an approved sender ID>
SMS_CHANNEL=dnd
```

Operational points that cost real messages if missed:

- Numbers are converted to MSISDN (`08031234567` → `2348031234567`) before they
  are sent; Termii does not route the local form.
-   `SMS_CHANNEL=dnd` is the transactional route on both gateways and the one
  OTPs belong on. `generic` is the promotional fallback (Sendchamp calls it
  `non_dnd`): it drops numbers on DND, and MTN blocks Termii's generic route
  between 8pm and 8am. The DND route is enabled per account by the provider.
- The sender ID must be approved on the account, otherwise the gateway
  rejects the send with a 400.
- If the gateway rejects a send, the API answers `502 SMS_FAILED`, tells the
  learner the code could not be sent, and drops the code so the 60-second
  cooldown does not block an immediate retry. The gateway's own reason goes to
  the server log only. Sendchamp sometimes answers 200 while rejecting the
  message in the body; a body-level `status: "failed"` is treated the same way.
- Termii gives new accounts free test credit; Sendchamp gives 50 free SMS
  units. Either can be exhausted quickly, so check the balance before an exam.
  Switching provider is `SMS_PROVIDER` plus `SMS_API_KEY` and a redeploy.

With `SMS_CHANNEL=dnd` and no DND activation, every send fails with a 400 from
Termii and the learner sees the "could not send" message — that is the account,
not the code.

## 6. Post-deploy checklist

- [ ] `GET /api/v1/health` returns ok over HTTPS
- [ ] The sign-in screen loads and the app installs (manifest + service worker)
- [ ] A learner can request an OTP; with a real SMS provider the code is **not** echoed in the response
- [ ] `GET /api/v1/config` reports `demo: false` and the provider names you expect
- [ ] A foreign `Origin` header is rejected with 403
- [ ] `npm run security:check` passes with `NODE_ENV=production`
- [ ] The data volume is backed up and `DATABASE_FILE` survives a restart
- [ ] Restarting the service keeps the same accounts (the disk is attached)

## Operations notes

- **Backups.** The store is a single JSON file written atomically. Back it up by copying the file between writes, or run the pilot on Postgres for real durability.
- **Restarts.** `SIGINT`/`SIGTERM` flush pending writes before exit.
- **Secrets.** Never commit `.env`; it is gitignored and `npm run security:check` fails if it becomes tracked.
- **Rollback.** Deploy the previous image/tag; the data file is forward compatible (version 1) but take a backup first.
