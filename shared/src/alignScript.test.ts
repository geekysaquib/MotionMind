import { describe, expect, it } from '@jest/globals';
import { alignScript, clipToLoud, narrationKey, placeWords, runsFromPeaks, wordsOf, type SpeechRun } from './alignScript';

const NARR = ['Subah dus baje Tatkal khulta hai.', 'Load balancer requests ko baant deta hai.', 'Bas.'];
const WIN = { start: 0, end: 20 };

/** Speech runs that look like a person reading NARR: each word a run, a short pause between scenes. */
function reading(scenes: number[][], pause = 1.2, startAt = 0.5): SpeechRun[] {
  const runs: SpeechRun[] = [];
  let t = startAt;
  scenes.forEach((words) => {
    words.forEach((len) => {
      runs.push({ start: t, end: t + len });
      t += len + 0.05;
    });
    t += pause;
  });
  return runs;
}

describe('narrationKey and wordsOf', () => {
  it('splits words, and changes when the narration changes', () => {
    expect(wordsOf('  Ek   do\nteen ')).toEqual(['Ek', 'do', 'teen']);
    expect(narrationKey(NARR)).toBe(narrationKey([...NARR]));
    expect(narrationKey(NARR)).not.toBe(narrationKey([NARR[0]!, NARR[1]!, 'Bas bas.']));
  });
});

describe('runsFromPeaks', () => {
  it('finds the stretches where the waveform is loud, joining breaths shorter than 0.2 s', () => {
    // 20 per second: loud 1.0 to 3.0 s, a 0.1 s dip, loud to 4.0 s, quiet, loud 6.0 to 7.0 s.
    const peaks = Array.from({ length: 160 }, (_, i) => {
      const t = i / 20;
      return (t >= 1 && t < 3) || (t >= 3.1 && t < 4) || (t >= 6 && t < 7) ? 70 : 1;
    });
    const runs = runsFromPeaks(peaks);
    expect(runs).toHaveLength(2);
    expect(runs[0]!.start).toBeCloseTo(1, 1);
    expect(runs[0]!.end).toBeCloseTo(4, 1);
    expect(runs[1]!.start).toBeCloseTo(6, 1);
    expect(runsFromPeaks([])).toEqual([]);
    expect(runsFromPeaks(Array.from({ length: 100 }, () => 2))).toEqual([]);
  });
});

describe('alignScript', () => {
  // 6 + 7 + 1 words; each scene's words take about the same time per letter.
  const runs = reading([
    [0.4, 0.3, 0.4, 0.5, 0.5, 0.3],
    [0.4, 0.7, 0.7, 0.2, 0.4, 0.4, 0.3],
    [0.5],
  ]);

  it('puts the breaks in the pauses between the scenes, just before the next scene starts speaking', () => {
    const fit = alignScript(NARR, runs, WIN)!;
    expect(fit.cuts).toHaveLength(2);
    // Scene 1 speech ends at about 3.0 s; scene 2 starts speaking at about 4.2 s.
    expect(fit.cuts[0]).toBeGreaterThan(3.0);
    expect(fit.cuts[0]).toBeLessThanOrEqual(4.3);
    expect(fit.cuts[1]).toBeGreaterThan(fit.cuts[0]! + 3);
  });

  it('gives every word a start and end inside its scene, in order', () => {
    const fit = alignScript(NARR, runs, WIN)!;
    expect(fit.wordTimes).toHaveLength(14);
    const edges = [0, ...fit.cuts, WIN.end];
    let i = 0;
    NARR.forEach((n, k) => {
      for (let j = 0; j < wordsOf(n).length; j++, i++) {
        const [s, e] = fit.wordTimes[i]!;
        expect(s).toBeGreaterThanOrEqual(edges[k]! - 0.01);
        expect(e).toBeLessThanOrEqual(edges[k + 1]! + 0.01);
        expect(e).toBeGreaterThan(s);
        if (i > 0) expect(s).toBeGreaterThanOrEqual(fit.wordTimes[i - 1]![0]);
      }
    });
    // The first word starts when the speaker starts.
    expect(fit.wordTimes[0]![0]).toBeCloseTo(0.5, 1);
  });

  it('does not stretch a scene over the pauses: a word is never spoken in silence', () => {
    const fit = alignScript(NARR, runs, WIN)!;
    // The last word of scene 1 ends when its speech ends (about 3.0 s), not at the scene break.
    expect(fit.wordTimes[5]![1]).toBeLessThan(3.4);
    // The first word of scene 2 starts when its speech starts.
    expect(fit.wordTimes[6]![0]).toBeGreaterThan(fit.cuts[0]! - 0.01);
  });

  it('copes with a recording whose scenes are not separated by long pauses', () => {
    const tight = reading([[0.4, 0.3, 0.4, 0.5, 0.5, 0.3], [0.4, 0.7, 0.7, 0.2, 0.4, 0.4, 0.3], [0.5]], 0.25);
    const fit = alignScript(NARR, tight, WIN)!;
    expect(fit.cuts).toHaveLength(2);
    expect(fit.cuts[0]).toBeGreaterThan(2.5);
    expect(fit.cuts[0]).toBeLessThan(4);
  });

  it('works from the loudness of a recording (a few long speech runs) the same way', () => {
    const phrases: SpeechRun[] = [
      { start: 0.5, end: 3.0 },
      { start: 4.2, end: 8.0 },
      { start: 9.5, end: 10.2 },
    ];
    const fit = alignScript(NARR, phrases, WIN)!;
    expect(fit.cuts[0]).toBeGreaterThan(3.0);
    expect(fit.cuts[0]).toBeLessThanOrEqual(4.2);
    expect(fit.cuts[1]).toBeGreaterThan(8.0);
    expect(fit.cuts[1]).toBeLessThanOrEqual(9.5);
  });

  it('uses only the trimmed part of the recording, and a single scene needs no breaks', () => {
    const fit = alignScript(NARR, runs, { start: 0.4, end: 12 })!;
    expect(fit.wordTimes[0]![0]).toBeGreaterThanOrEqual(0.4);
    const one = alignScript(['Ek do teen.'], [{ start: 1, end: 2 }], { start: 0, end: 5 })!;
    expect(one.cuts).toEqual([]);
    expect(one.wordTimes).toHaveLength(3);
    expect(one.wordTimes[2]![1]).toBeCloseTo(2, 1);
  });

  it('has nothing to fit to when no speech was heard', () => {
    expect(alignScript(NARR, [], WIN)).toBeNull();
    expect(alignScript(NARR, [{ start: 1, end: 1.2 }], WIN)).toBeNull();
    expect(alignScript([], runs, WIN)).toBeNull();
  });
});

describe('placeWords', () => {
  const runs = reading([[0.4, 0.3, 0.4, 0.5, 0.5, 0.3], [0.4, 0.7, 0.7, 0.2, 0.4, 0.4, 0.3], [0.5]]);
  it('fits the words to scene breaks that were moved by hand', () => {
    const auto = alignScript(NARR, runs, WIN)!;
    const moved = placeWords(NARR, runs, [0, auto.cuts[0]! - 0.3, auto.cuts[1]!, WIN.end]);
    expect(moved).toHaveLength(14);
    // Scene 2's first word is still spoken when its speech starts, however the break is moved inside the pause.
    expect(moved[6]![0]).toBeCloseTo(auto.wordTimes[6]![0], 1);
  });
});

describe('clipToLoud', () => {
  it('cuts recognised words back to where the voice is really loud, so pauses stay pauses', () => {
    const words = [{ start: 0.1, end: 4.3 }];
    const loud = [{ start: 0.1, end: 2.85 }, { start: 4.9, end: 8 }];
    expect(clipToLoud(words, loud)).toEqual([{ start: 0.1, end: 2.85 }]);
    expect(clipToLoud(words, [])).toEqual(words);
    expect(clipToLoud(words, [{ start: 9, end: 10 }])).toEqual(words);
  });
});
