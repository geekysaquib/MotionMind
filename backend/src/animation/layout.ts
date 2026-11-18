import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { prepareProject } from '../export/hyperframes';

const require = createRequire(import.meta.url);

/** One layout problem the checker found in Claude's animation. */
export interface LayoutIssue {
  code: string;
  /** Seconds into the reel where it first shows. */
  time: number;
  /** The text that is affected, if any. */
  text: string | null;
  message: string;
  /** How long it lasts, in seconds. */
  seconds: number;
}

export interface LayoutReport {
  ok: boolean;
  issues: LayoutIssue[];
  /** How many distinct problems there were before the list was capped. */
  total: number;
}

/** Opens the animation in headless Chrome and looks for text that overlaps, is hidden or spills out. */
export type LayoutChecker = (html: string, durationSec: number) => Promise<LayoutReport>;

const MAX_ISSUES = 14;

/** Reads `hyperframes check --json` output (it prints log lines before the JSON). */
export function parseCheck(stdout: string): LayoutReport {
  const start = stdout.search(/^\{/m);
  if (start < 0) throw new Error('The layout check gave no result.');
  const data = JSON.parse(stdout.slice(start)) as {
    layout?: { findings?: { code: string; severity: string; time?: number; text?: string; message: string; heldMs?: number }[] };
  };
  const seen = new Map<string, LayoutIssue>();
  for (const f of data.layout?.findings ?? []) {
    if (f.severity !== 'error' && f.severity !== 'warning') continue;
    const key = `${f.code}|${f.text ?? ''}`;
    const time = Math.round((f.time ?? 0) * 10) / 10;
    if (seen.has(key) && seen.get(key)!.time <= time) continue;
    seen.set(key, { code: f.code, time, text: f.text?.trim() || null, message: f.message, seconds: Math.round(((f.heldMs ?? 0) / 1000) * 10) / 10 });
  }
  const all = [...seen.values()].sort((a, b) => a.time - b.time);
  return { ok: all.length === 0, issues: all.slice(0, MAX_ISSUES), total: all.length };
}

const PLAIN: Record<string, string> = {
  text_occluded: 'is hidden underneath another element',
  content_overlap: 'overlaps other text',
  text_overflow: 'spills out of its box',
  container_overflow: 'is cut off or runs past its container',
  text_clipped: 'is cut off',
};

/** The message the creator pastes into the same claude.ai chat to have the problems fixed. */
export function layoutFixRequest(report: LayoutReport): string {
  const lines = report.issues.map((i) => `- At ${i.time.toFixed(1)} s${i.text ? `, the text "${i.text}"` : ''} ${PLAIN[i.code] ?? i.message.replace(/\.$/, '').toLowerCase()}${i.seconds > 0.3 ? ` (for about ${i.seconds.toFixed(1)} s)` : ''}.`);
  return [
    'Your animation has layout problems. I opened it in a browser and measured every text box over the whole timeline:',
    ...lines,
    report.total > report.issues.length ? `(${report.total - report.issues.length} more of the same kind.)` : '',
    '',
    'Fix all of them and send the complete HTML file again, in one ```html code block, nothing else. Keep everything that already works. How to fix:',
    '- Give every panel, row and text its own zone. Build panels with CSS flex or grid so their height comes from their content; never give a panel a fixed height that is smaller than what is inside it, and never place two panels at absolute positions that overlap.',
    '- Count the vertical space: add up the heights of everything in a scene (with gaps) and make sure it fits between y 120 and y 1660. If it does not, show fewer rows or make things smaller.',
    '- Anything animated that changes its text (counters, scrambles, ticking numbers) lives in its own fixed-width box (font-variant-numeric: tabular-nums), so digits never overlap.',
    '- Elements that leave a scene must be fully gone (opacity 0 and visibility hidden) before the next scene shows, so scenes never overlap.',
  ].filter((l) => l !== '').join('\n');
}

/** The real checker: HyperFrames' own `check`, run in headless Chrome on this machine. */
export function hyperFramesLayoutChecker(): LayoutChecker {
  const bin = () => path.join(path.dirname(require.resolve('hyperframes/package.json')), 'bin', 'hyperframes.mjs');
  return async (html) => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'mm-layout-'));
    try {
      await prepareProject(dir, html);
      const out = await new Promise<string>((resolve, reject) => {
        const child = spawn(process.execPath, [bin(), 'check', dir, '--json', '--no-contrast', '--samples', '14', '--at-transitions', '--max-transition-samples', '16', '--budget', '120s'], { cwd: dir, windowsHide: true });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
        child.stderr.on('data', (d: Buffer) => (stderr = (stderr + d.toString()).slice(-4000)));
        child.on('error', reject);
        child.on('close', () => (stdout.includes('"layout"') ? resolve(stdout) : reject(new Error(stderr.trim().split(/\r?\n/).pop() || 'The layout check could not run.'))));
      });
      return parseCheck(out);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  };
}
