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
| `ALLOW_UNREVIEWED_TRANSLATIONS` | `false` once translations are approved |

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
docker build -t sabi .
docker run -p 4100:4100 --env-file .env -v sabi-data:/app/apps/api/data sabi
```

The image runs `npm run build` at build time and `npm start` at run time, as the
`node` user.

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

## 5. Post-deploy checklist

- [ ] `GET /api/v1/health` returns ok over HTTPS
- [ ] The sign-in screen loads and the app installs (manifest + service worker)
- [ ] A learner can request an OTP; with a real SMS provider the code is **not** echoed in the response
- [ ] `GET /api/v1/config` reports `demo: false` and the provider names you expect
- [ ] A foreign `Origin` header is rejected with 403
- [ ] `npm run security:check` passes with `NODE_ENV=production`
- [ ] The data volume is backed up and `DATABASE_FILE` survives a restart

## Operations notes

- **Backups.** The store is a single JSON file written atomically. Back it up by copying the file between writes, or run the pilot on Postgres for real durability.
- **Restarts.** `SIGINT`/`SIGTERM` flush pending writes before exit.
- **Secrets.** Never commit `.env`; it is gitignored and `npm run security:check` fails if it becomes tracked.
- **Rollback.** Deploy the previous image/tag; the data file is forward compatible (version 1) but take a backup first.
