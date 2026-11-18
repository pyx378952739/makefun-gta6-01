// The hand-in for this entry (Node 22, standard library only): the playable game is the
// game/ folder beside this file — plain static files a desktop browser loads offline, its page
// at game/index.html with plain ES modules, no library and no network request — and this program
// gathers it for the judge. It copies game/ and screenshots/ from beside this file into the
// output directory and writes output/dossier.json there, using the vendored make.fun library to
// build the dossier the scorer reads. The game itself is SOLARA BAY, an original open-world
// city game: walk and drive a seeded coastal city, steal cars, dodge the police, run jobs for
// cash and reputation, with a title screen, pause, busted and wasted endings, a job-complete
// screen, synthesised sound and staged screenshot scenes behind ?shot=.
//
// Serve it locally with `node serve.ts`, then open the local address it prints.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (from its gate): only text_max_bytes shapes the bytes; the others make
// this program refuse an entry the scorer would refuse — more than 4 screenshots or one over
// 256 KiB; more than 993 files in game/ or 48 MiB of game files in all, or a path under game/
// over 1000 bytes. game/ counts beside /output's own 1000-entry cap, with screenshots/ and
// dossier.json, which is why the file cap is 993 and not 1000.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
