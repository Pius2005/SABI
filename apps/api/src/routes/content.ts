import { Router } from 'express';
import type { Env } from '../env';
import type { Store } from '../store';
import { authenticate, normalizeLang } from '../auth';
import { lessonDetail, listPaths, pathDetail, uiStrings } from '../content-service';
import { fail } from '../http';

export function createContentRouter(store: Store, env: Env): Router {
  const router = Router();

  router.get('/paths', (req, res) => {
    const lang = normalizeLang(req.query.lang, env.defaultLanguage as never);
    res.json({ paths: listPaths(store, lang, env) });
  });

  router.get('/ui-strings/:lang', (req, res) => {
    const lang = normalizeLang(req.params.lang);
    res.json({ lang, ...uiStrings(store, lang, env) });
  });

  router.get('/paths/:slug', authenticate(store, env), (req, res) => {
    const lang = normalizeLang(req.query.lang, req.user!.preferredLang);
    const detail = pathDetail(store, req.params.slug, req.user!.id, lang, env);
    if (!detail) {
      fail(res, 404, 'NOT_FOUND', 'That learning path was not found.');
      return;
    }
    res.json({ path: detail });
  });

  router.get('/lessons/:slug', authenticate(store, env), (req, res) => {
    const lang = normalizeLang(req.query.lang, req.user!.preferredLang);
    const detail = lessonDetail(store, req.params.slug, lang, env);
    if (!detail) {
      fail(res, 404, 'NOT_FOUND', 'That lesson was not found.');
      return;
    }
    res.json({ lesson: detail });
  });

  router.get('/lessons/:slug/bundle', authenticate(store, env), (req, res) => {
    const lang = normalizeLang(req.query.lang, req.user!.preferredLang);
    const detail = lessonDetail(store, req.params.slug, lang, env);
    if (!detail) {
      fail(res, 404, 'NOT_FOUND', 'That lesson was not found.');
      return;
    }
    const path = pathDetail(store, detail.pathSlug, req.user!.id, lang, env);
    res.json({
      lesson: detail,
      path,
      strings: uiStrings(store, lang, env).strings,
      downloadedAt: new Date().toISOString(),
    });
  });

  return router;
}
