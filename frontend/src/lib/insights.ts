import { STYLES, styleOf, type Project } from '@motionmind/shared';
import { progressOf, stageDone, STAGE_INFO } from './progress';

const DAY = 86_400_000;
const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The numbers on Home, worked out from the creator's own projects (archived ones left out). */
export function insights(all: Project[], now = Date.now()) {
  const items = all.filter((p) => p.status !== 'archived');
  const created = items.map((p) => Date.parse(p.createdAt)).filter(Number.isFinite);
  const inWindow = (from: number, to: number) => created.filter((t) => t >= from && t < to).length;
  const thisWeek = inWindow(now - 7 * DAY, now + 1);
  const lastWeek = inWindow(now - 14 * DAY, now - 7 * DAY);

  // Reels touched per day over the last 14 days (created or worked on), oldest first.
  const days = Array.from({ length: 14 }, (_, i) => now - (13 - i) * DAY);
  const touched = new Map<string, number>();
  for (const p of items) for (const t of new Set([dayKey(Date.parse(p.createdAt)), dayKey(Date.parse(p.updatedAt))])) touched.set(t, (touched.get(t) ?? 0) + 1);
  const activity = days.map((t) => ({
    label: new Date(t).toLocaleDateString(undefined, { day: 'numeric' }),
    hint: new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
    value: touched.get(dayKey(t)) ?? 0,
  }));

  // How many reels have got through each step.
  const pipeline = STAGE_INFO.map((s, i) => ({ label: s.label, value: items.filter((p) => stageDone(p)[i]).length }));

  const styleCount = new Map<string, number>();
  for (const p of items) if (p.script?.style) styleCount.set(p.script.style, (styleCount.get(p.script.style) ?? 0) + 1);
  const styles = [...styleCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, value]) => ({ label: styleOf(id).name, value }));

  const seconds = items.reduce((n, p) => n + (p.durationSec || 0), 0);
  const avgProgress = items.length ? items.reduce((n, p) => n + progressOf(p), 0) / items.length : 0;

  return {
    total: items.length,
    finished: items.filter((p) => p.status === 'completed').length,
    working: items.filter((p) => p.status === 'draft' || p.status === 'in_progress').length,
    thisWeek,
    weekDelta: thisWeek - lastWeek,
    avgProgress,
    minutes: Math.round(seconds / 60),
    activity,
    pipeline,
    styles,
    stylesTried: styleCount.size,
    stylesTotal: Object.keys(STYLES).length,
    platforms: {
      instagram: items.filter((p) => p.platforms.includes('instagram')).length,
      youtube: items.filter((p) => p.platforms.includes('youtube')).length,
    },
  };
}
