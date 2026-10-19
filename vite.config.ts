import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Keeps src/assets/sprites in sync with the art folder in assets.config.json:
 * imports everything on dev-server start, then re-imports each PNG as it is added/changed.
 */
function assetSync(): Plugin {
  return {
    name: 'neon-duel-asset-sync',
    apply: 'serve',
    async configureServer(server) {
      // dev-only: POST a PNG to /__shot?name=x → saved under $TMPDIR/neon-duel-shots (used for automated visual checks)
      server.middlewares.use('/__shot', (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          const name = new URL(req.url ?? '', 'http://x').searchParams.get('name')?.replace(/[^\w-]/g, '') || 'shot';
          const dir = path.join(os.tmpdir(), 'neon-duel-shots');
          fs.mkdirSync(dir, { recursive: true });
          const file = path.join(dir, name + '.png');
          fs.writeFileSync(file, Buffer.concat(chunks));
          res.end(file);
        });
      });
      // @ts-expect-error — plain .mjs tool without type declarations
      const imp = await import('./tools/import-assets.mjs');
      const src: string | null = imp.sourceDir();
      if (!src || !fs.existsSync(src)) {
        server.config.logger.info('[assets] no sourceDir configured — using src/assets/sprites as is');
        return;
      }
      const log = (m: string) => server.config.logger.info(m, { timestamp: true });
      // initial import runs in the background so the server starts immediately
      imp.importMany(imp.listSource(src), src, log).then(() => log('[assets] initial import done'));

      const pending = new Set<string>();
      let timer: NodeJS.Timeout | null = null;
      const queue = (file: string | null) => {
        if (!file || !file.endsWith('.png') || file.startsWith('original-')) return;
        pending.add(file.slice(0, -4));
        if (timer) clearTimeout(timer);
        // wait for the file to finish writing
        timer = setTimeout(async () => {
          const names = [...pending];
          pending.clear();
          if (names.some((n) => n.endsWith('_idle'))) imp.resetCaches();
          // re-import siblings of a changed idle so the whole character keeps one scale
          const all: string[] = imp.listSource(src);
          const extra = names.filter((n) => n.endsWith('_idle')).flatMap((n) => all.filter((a) => a.startsWith(n.slice(0, -5) + '_') && !names.includes(a)));
          await imp.importMany([...names, ...extra], src, log, true);
        }, 600);
      };
      for (const dir of (imp.sourceDirs(src) as string[]).flatMap((d: string) => [d, path.join(d, '_originals')])) {
        if (!fs.existsSync(dir)) continue;
        fs.watch(dir, (_ev, file) => queue(file ? String(file) : null));
      }
      log(`[assets] watching ${src}`);
    },
  };
}

/** serves the leaderboard API (server/api.mjs, Neon Postgres + Object Storage) from the dev server */
function leaderboardApi(): Plugin {
  return {
    name: 'neon-duel-leaderboard-api',
    async configureServer(server) {
      // @ts-expect-error — plain .mjs server module
      const { apiMiddleware } = await import('./server/api.mjs');
      server.middlewares.use(apiMiddleware);
    },
    async configurePreviewServer(server) {
      // @ts-expect-error — plain .mjs server module
      const { apiMiddleware } = await import('./server/api.mjs');
      server.middlewares.use(apiMiddleware);
    },
  };
}

export default defineConfig({ base: './', server: { port: 5173 }, plugins: [assetSync(), leaderboardApi()] });
