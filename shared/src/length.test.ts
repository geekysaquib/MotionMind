import { describe, expect, it } from '@jest/globals';
import { lengthPlan, lengthWarning, narrationWords } from './length';

const beats = (words: number) => [{ narration: Array.from({ length: words }, () => 'shabd').join(' ') }];

describe('lengthPlan', () => {
  it('scales words and scenes with the chosen length', () => {
    expect(lengthPlan(60)).toMatchObject({ words: { target: 156 }, beats: { min: 8, max: 11 } });
    expect(lengthPlan(90)).toMatchObject({ words: { min: 215, target: 234, max: 253 }, beats: { min: 13, max: 16 } });
    expect(lengthPlan(15).beats.min).toBe(3);
  });

  it('warns when the narration is clearly too short or too long for the length', () => {
    expect(narrationWords([{ narration: ' ek  do teen ' }])).toBe(3);
    expect(lengthWarning(beats(160), 90)).toMatch(/shorter than the 90 seconds/);
    expect(lengthWarning(beats(234), 90)).toBeNull();
    expect(lengthWarning(beats(400), 90)).toMatch(/longer than the 90 seconds/);
  });
});
