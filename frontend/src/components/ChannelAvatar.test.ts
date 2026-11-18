import { describe, expect, it } from '@jest/globals';
import { initialsOf } from './ChannelAvatar';

describe('initialsOf', () => {
  it('takes two letters from the handle', () => {
    expect(initialsOf('decodifyx')).toBe('DE');
    expect(initialsOf('@decodify_x')).toBe('DX');
    expect(initialsOf('tech.with.sam')).toBe('TW');
  });
  it('falls back to the name, then a question mark', () => {
    expect(initialsOf(null, 'Demo')).toBe('DE');
    expect(initialsOf('', '')).toBe('?');
  });
});
