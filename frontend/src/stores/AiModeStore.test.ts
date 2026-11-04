import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AiModeStore } from './AiModeStore';

describe('AiModeStore', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts on copy and paste, and saves a choice to the account as well as the browser', () => {
    const save = jest.fn();
    const s = new AiModeStore(save);
    expect(s.mode).toBe('paste');
    s.set('keys');
    expect(s.mode).toBe('keys');
    expect(save).toHaveBeenCalledWith('keys');
    expect(window.localStorage.getItem('motionmind-ai-mode')).toBe('keys');
  });

  it("the account's choice wins over this browser's, without saving it back", () => {
    window.localStorage.setItem('motionmind-ai-mode', 'keys');
    const save = jest.fn();
    const s = new AiModeStore(save);
    s.adopt('paste');
    expect(s.mode).toBe('paste');
    expect(window.localStorage.getItem('motionmind-ai-mode')).toBe('paste');
    expect(save).not.toHaveBeenCalled();
  });

  it('an account that has not chosen yet receives the browser\'s earlier choice', () => {
    window.localStorage.setItem('motionmind-ai-mode', 'keys');
    const save = jest.fn();
    const s = new AiModeStore(save);
    s.adopt(null);
    expect(s.mode).toBe('keys');
    expect(save).toHaveBeenCalledWith('keys');
  });

  it('with no earlier choice anywhere it stays on the default and saves nothing', () => {
    const save = jest.fn();
    const s = new AiModeStore(save);
    s.adopt(null);
    expect(s.mode).toBe('paste');
    expect(save).not.toHaveBeenCalled();
  });
});
