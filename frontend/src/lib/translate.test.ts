import { describe, expect, it } from '@jest/globals';
import { parseTranslation, translatePrompt, TranslationError } from './translate';

describe('translate', () => {
  it('asks for one line per scene in the chosen language, with the creator’s note', () => {
    const p = translatePrompt(['Ek.', 'Do.'], 'Tamil', 'Keep it formal');
    expect(p).toContain('into natural, spoken Tamil');
    expect(p).toContain('exactly 2 strings');
    expect(p).toContain('Extra instructions from the creator: Keep it formal');
    expect(translatePrompt(['Ek.'], 'Hindi')).toContain('Devanagari');
  });
  it('reads the answer with or without a fence, and refuses a wrong count', () => {
    expect(parseTranslation('```json\n["a", "b"]\n```', 2)).toEqual(['a', 'b']);
    expect(parseTranslation('Here you go: ["a","b"]', 2)).toEqual(['a', 'b']);
    expect(() => parseTranslation('["a"]', 2)).toThrow(TranslationError);
    expect(() => parseTranslation('nope', 2)).toThrow(TranslationError);
  });
});
