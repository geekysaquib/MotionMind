import { describe, expect, it } from '@jest/globals';
import { checkHandle, normalizeHandle, handleSchema } from './handle';

describe('handle rules', () => {
  it('normalizes @ and case', () => expect(normalizeHandle('  @Samjho.Studio ')).toBe('samjho.studio'));
  it.each([
    ['ab', 'too_short'],
    ['a'.repeat(31), 'too_long'],
    ['hello world', 'invalid_chars'],
    ['.start', 'dots'],
    ['end.', 'dots'],
    ['two..dots', 'dots'],
    ['admin', 'reserved'],
  ])('rejects %s', (h, problem) => expect(checkHandle(h)).toBe(problem));
  it('accepts a good handle', () => expect(checkHandle('samjho_studio.in')).toBeNull());
  it('schema returns the normalized value', () => expect(handleSchema.parse('@Gyaan_Frames')).toBe('gyaan_frames'));
});
