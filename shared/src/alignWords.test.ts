import { describe, expect, it } from '@jest/globals';
import { matchWords, sceneStartsFromWords, snapToVoice, type HeardWord } from './alignWords';

const NARR = ['Subah das baje Tatkal booking khulti hai.', 'Load balancer requests ko servers mein baant deta hai.', 'Bas itna hi.'];

describe('matchWords', () => {
  it('matches words in order, even when some are spelled differently or missing', () => {
    const m = matchWords(['ek', 'do', 'teen', 'chaar'], ['ek', 'doo', 'chaar']);
    expect(m).toEqual([0, 1, null, 2]);
  });
  it('still lines the words up when whisper writes another script, if the counts are close', () => {
    const m = matchWords(['ek', 'do', 'teen'], ['एक', 'दो', 'तीन']);
    expect(m).toEqual([0, 1, 2]);
  });
});

describe('sceneStartsFromWords', () => {
  // Text-to-speech read straight through: no pause between scenes, and whisper glued the first words together.
  const heard: HeardWord[] = [
    { text: 'Subaclidospagetat', start: 0.14, end: 1.19 },
    { text: 'Calbooking', start: 1.19, end: 1.94 },
    { text: 'Colt-i-hi.', start: 1.94, end: 2.8 },
    { text: 'Load', start: 3.6, end: 3.65 },
    { text: 'Balancer', start: 3.6, end: 3.88 },
    { text: 'Requests', start: 3.88, end: 4.6 },
    { text: 'K-O', start: 4.6, end: 4.88 },
    { text: 'servers', start: 4.88, end: 5.54 },
    { text: 'main', start: 5.54, end: 5.86 },
    { text: 'Bont-D-i-hi.', start: 5.86, end: 6.8 },
    { text: 'Basset-i-hi.', start: 7.68, end: 8.56 },
  ];
  it('starts each scene where its first word is spoken', () => {
    const cuts = sceneStartsFromWords(NARR, heard, [], { start: 0, end: 9.4 })!;
    expect(cuts).toHaveLength(2);
    expect(cuts[0]).toBeGreaterThan(3.2);
    expect(cuts[0]).toBeLessThanOrEqual(3.65);
    expect(cuts[1]).toBeGreaterThan(7.2);
    expect(cuts[1]).toBeLessThanOrEqual(7.7);
  });
  it('gives up when the heard words cannot be this script', () => {
    expect(sceneStartsFromWords(NARR, heard.slice(0, 3), [], { start: 0, end: 9.4 })).toBeNull();
    expect(sceneStartsFromWords(['Ek do teen.'], heard, [], { start: 0, end: 9.4 })).toBeNull();
  });
});

describe('snapToVoice', () => {
  it('moves word starts forward to where the voice begins and ends back to where it stops', () => {
    const loud = [{ start: 1, end: 2 }, { start: 3, end: 4 }];
    expect(snapToVoice([[2.4, 3.6]], loud)).toEqual([[3, 3.6]]);
    expect(snapToVoice([[1.2, 2.5]], loud)).toEqual([[1.2, 2]]);
  });
});
