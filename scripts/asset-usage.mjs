// Which 3D objects do reels actually use? Counts every object kind, icon name, emoji and custom shape across all
// saved scripts, so the next hand-built models go to what people really need. Prints counts only, never titles or users.
//   npm run assets:usage
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env).');
const db = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await db.from('projects').select('script').not('script', 'is', null);
if (error) throw error;

const kinds = new Map();
const glyphs = new Map();
const emojis = new Map();
const themes = new Map();
const bump = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
let scenes = 0;
let scripts = 0;
for (const { script } of data) {
  scripts++;
  bump(themes, script.theme ?? '(none)');
  for (const b of script.beats ?? []) {
    if (!b.scene) continue;
    scenes++;
    for (const p of b.scene.props ?? []) {
      bump(kinds, p.kind);
      if (p.kind === 'custom') {
        if (p.glyph) bump(glyphs, p.glyph);
        else if (p.icon) bump(emojis, p.icon);
      }
    }
  }
}
const top = (m, n = 25) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${String(v).padStart(4)}  ${k}`).join('\n') || '  (none)';
console.log(`${scripts} scripts, ${scenes} scenes with 3D objects\n\nOBJECT KINDS\n${top(kinds)}\n\nICON TILES (candidates for hand-built models)\n${top(glyphs)}\n\nEMOJI FALLBACKS\n${top(emojis)}\n\nTHEMES\n${top(themes)}`);
