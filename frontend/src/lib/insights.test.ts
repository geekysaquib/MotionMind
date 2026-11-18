import { describe, expect, it } from '@jest/globals';
import type { Project } from '@motionmind/shared';
import { insights } from './insights';

const now = Date.parse('2026-11-16T12:00:00Z');
const day = 86_400_000;
const project = (over: Partial<Project>): Project =>
  ({
    id: Math.random().toString(36),
    title: 'Reel',
    topic: 'How UPI works',
    status: 'draft',
    stage: 'topic',
    durationSec: 60,
    platforms: ['instagram', 'youtube'],
    createdAt: new Date(now - day).toISOString(),
    updatedAt: new Date(now - day).toISOString(),
    ...over,
  }) as Project;

describe('insights', () => {
  it('counts reels, the week trend, styles and the steps reached, leaving archived reels out', () => {
    const items = [
      project({ status: 'completed', script: { title: 't', beats: [], style: 'dark-keynote' } as never }),
      project({ script: { title: 't', beats: [], style: 'dark-keynote' } as never, createdAt: new Date(now - 9 * day).toISOString() }),
      project({ platforms: ['instagram'] }),
      project({ status: 'archived' }),
    ];
    const r = insights(items, now);
    expect(r).toMatchObject({ total: 3, finished: 1, working: 2, thisWeek: 2, weekDelta: 1, minutes: 3, stylesTried: 1 });
    expect(r.styles).toEqual([{ label: 'Dark Keynote', value: 2 }]);
    expect(r.platforms).toEqual({ instagram: 3, youtube: 2 });
    expect(r.pipeline[0]).toEqual({ label: 'Topic', value: 3 });
    expect(r.activity).toHaveLength(14);
    expect(r.activity.at(-2)!.value).toBe(3);
  });

  it('is all zeros with no reels', () => {
    expect(insights([], now)).toMatchObject({ total: 0, avgProgress: 0, styles: [], thisWeek: 0 });
  });
});
