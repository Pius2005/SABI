# Security and privacy checklist

Use this before every production release and after any change to auth, the
assistant, storage or provider configuration. `npm run security:check` automates
the items marked **[auto]**; the rest are manual and must be signed off.

Last reviewed: 2026-11-24. Automated result: **27/27 passed**.

## 1. Secrets and configuration

- [x] **[auto]** `.env` is gitignored and not tracked by git.
- [x] **[auto]** `apps/api/data/` (the JSON store) is gitignored.
- [x] **[auto]** `dist/`, `coverage/` and generated reports are gitignored.
- [x] **[auto]** No provider secret is hard-coded in source.
- [x] **[auto]** `.env.example` contains no real credential values.
- [ ] Production sets unique `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and
      `ENCRYPTION_KEY` (32+ random characters each). The `dev-*` defaults are
      refused outside development.
- [ ] `NODE_ENV=production` and `ALLOW_UNREVIEWED_TRANSLATIONS=false`.
- [ ] `WEB_ORIGIN` lists only the real HTTPS origin(s), no wildcards.
- [ ] Provider keys live in the platform secret store, not in an image or repo.
- [ ] Keys are rotated after any suspected exposure and on staff departure.

**Note:** changing `ENCRYPTION_KEY` makes every stored phone number unreadable.
Rotate it only with a migration plan.

## 2. Authentication

- [x] **[auto]** OTP codes are hashed at rest, never stored in plaintext.
- [x] **[auto]** OTP attempts are rate limited and lock out after 5 failures.
- [x] **[auto]** Staff logins are rate limited and lock out after 5 failures.
- [x] **[auto]** Staff passwords are compared with bcrypt.
- [x] Access tokens are short-lived JWTs (30 minutes) with a `typ: access` claim.
- [x] Refresh tokens are opaque, hashed at rest, rotated on use and revoked on
      logout.
- [x] Learner sessions are bound to a user that still exists and is not deleted.
- [x] Roles are enforced per route (`requireRole`) and per record (facilitator
      groups, family links).
- [ ] Production SMS provider is configured; `devCode` is absent from responses.
- [ ] OTP delivery is monitored for failure and abuse.
- [ ] Staff accounts are created deliberately, not by public sign-up.

## 3. Learner data

- [x] **[auto]** Stored phone numbers are encrypted, never plaintext.
- [x] **[auto]** Encrypted phone values are not the raw number.
- [x] Phone lookup uses an HMAC hash, not the ciphertext.
- [x] Display uses a mask (`0803 *** 0001`), never the full number.
- [x] Export (`GET /me/export`) returns the learner's own data as JSON.
- [x] Delete (`DELETE /me`) removes profile data, progress, consents, tokens,
      OTP rows and reminders, and revokes family links.
- [x] Typed questions are not stored unless `store_transcripts` is granted.
- [x] Family scopes default to progress only; transcripts require explicit
      consent.
- [x] Audit log records sensitive actions without copying the sensitive value.
- [ ] Retention period is agreed with the owner and matches the privacy notice.
- [ ] Backups are encrypted and access-controlled.
- [ ] A data-subject request process exists (who answers, within what time).

## 4. Assistant safety

- [x] **[auto]** Assistant routes accept no audio.
- [x] **[auto]** Speech routes are absent.
- [x] **[auto]** Sensitive values are redacted before storage.
- [x] **[auto]** Assistant replies are sanitised.
- [x] Crisis language is detected before any model call.
- [x] Credential-sharing or credential-requesting prompts are refused and the
      text is dropped.
- [x] "Are you a human?" gets an explicit AI disclosure.
- [x] Medical, legal and money questions are redirected to a professional.
- [x] AI disclosure is visible in the app shell on every screen.
- [x] Assistant turns are rate limited (20 per minute per user).
- [x] `npm run assistant:eval` covers 50 safety cases and is a release gate.
- [ ] A human review sample of real pilot answers is scheduled weekly.
- [ ] The escalation contact for crisis cases is staffed during pilot hours.

## 5. Scam checker

- [x] Credential requests are always `scam`, never `safe`.
- [x] Warnings against sharing credentials are never treated as requests.
- [x] Verdicts are hedged (`scam`, `unsure`, `safe`) with reasons and next steps.
- [x] `npm run scam:eval` enforces the invariant and a 90% accuracy floor.
- [ ] New real-world scam messages are added as fixtures after each pilot week.
- [ ] The support script tells learners the checker can be wrong and to ask a
      person when unsure.

## 6. Transport and HTTP

- [x] **[auto]** CORS uses an exact allow-list, not a wildcard.
- [x] **[auto]** Helmet security headers are enabled.
- [x] **[auto]** `x-powered-by` is disabled.
- [x] Request bodies are size-limited (1 MB JSON, 200 kB form).
- [x] Unknown `/api` routes return a JSON 404.
- [x] A disallowed `Origin` returns 403.
- [ ] TLS terminates in front of the app; HTTP is not exposed publicly.
- [ ] HSTS is set at the proxy (the app does not set it itself).
- [ ] Rate limits are enforced at the edge as well as in-process.
- [ ] A CSP is set at the proxy or enabled in Helmet after testing the build.

## 7. Content and translations

- [x] English is authoritative; other languages are overlays.
- [x] Every string has a review status.
- [x] Unreviewed strings are served only in pilot mode, with a visible notice.
- [x] Missing strings fall back to English and are marked.
- [ ] Native speakers approve yo/ig/pcm before production.
- [ ] Safety copy is re-reviewed in every language, not only translated.

## 8. Dependencies and build

- [x] `package-lock.json` is committed.
- [x] CI runs `npm ci` and `npm run verify`.
- [ ] `npm audit` is reviewed; no critical or high advisory is unresolved.
- [ ] The Docker image is rebuilt from a pinned base and scanned.
- [ ] The build artifact contains no source maps with secrets or `.env` values.
- [ ] Third-party scripts are absent from the PWA.

## 9. Logging and monitoring

- [x] Sensitive values are redacted before storage.
- [x] The mock SMS provider masks the code it logs.
- [x] No console logging in the shared safety module.
- [x] Audit log captures sign-in, consent, export, delete, translation, scam and
      help-request events.
- [ ] Production logs exclude phone numbers, OTPs, tokens and free text.
- [ ] Alerts exist for: OTP failure spike, 5xx spike, provider outage, unusual
      export/delete volume.
- [ ] Log retention and access are defined.

## 10. Operations

- [ ] `DATABASE_FILE` is on a persistent, backed-up volume.
- [ ] Restore from backup has been tested, not just configured.
- [ ] Health check is monitored (`GET /api/v1/health`).
- [ ] A rollback image/tag is known and tested.
- [ ] Incident contacts and severity levels are agreed
      (`docs/INCIDENT_RESPONSE.md`).
- [ ] Staff have signed the acceptable-use and data-handling agreement.
- [ ] A vulnerability disclosure route exists for researchers.

## Release sign-off

| Item | Name | Date | Result |
| --- | --- | --- | --- |
| Automated checks |  |  |  |
| Manual security review |  |  |  |
| Accessibility review |  |  |  |
| Content/language review |  |  |  |
| Product owner approval |  |  |  |

A release is blocked by any unchecked item in sections 1–6. Items in sections
7–10 may be scheduled only with the owner's written acceptance.
