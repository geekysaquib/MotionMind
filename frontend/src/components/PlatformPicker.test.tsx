import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import { normalizePlatforms, type Platform } from '@motionmind/shared';
import { closingLine } from '../lib/closing';
import { PlatformPicker } from './PlatformPicker';

describe('PlatformPicker', () => {
  it('turns platforms on and off, always keeps one, and keeps a fixed order', () => {
    const onChange = jest.fn<(p: Platform[]) => void>();
    const { rerender } = render(<PlatformPicker value={['instagram']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /YouTube Shorts/ }));
    expect(onChange).toHaveBeenLastCalledWith(['instagram', 'youtube']);
    fireEvent.click(screen.getByRole('button', { name: /Instagram Reels/ })); // the last one stays on
    expect(onChange).toHaveBeenCalledTimes(1);
    rerender(<PlatformPicker value={['youtube']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Instagram Reels/ }));
    expect(onChange).toHaveBeenLastCalledWith(['instagram', 'youtube']);
    rerender(<PlatformPicker value={['instagram', 'youtube']} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Instagram Reels/ }));
    expect(onChange).toHaveBeenLastCalledWith(['youtube']);
  });
});

describe('platform helpers', () => {
  it('cleans a saved list: known platforms, fixed order, never empty', () => {
    expect(normalizePlatforms(['youtube', 'instagram', 'x'])).toEqual(['instagram', 'youtube']);
    expect(normalizePlatforms(undefined)).toEqual(['instagram', 'youtube']);
    expect(normalizePlatforms([])).toEqual(['instagram', 'youtube']);
    expect(normalizePlatforms(['youtube'])).toEqual(['youtube']);
  });

  it('closes the voice script with follow, subscribe, or both, in each language', () => {
    expect(closingLine('en', 'X', ['instagram'])).toBe('Follow X for more explainers like this.');
    expect(closingLine('en', 'X', ['youtube'])).toBe('Subscribe to X for more explainers like this.');
    expect(closingLine('en', 'X', ['instagram', 'youtube'])).toMatch(/Follow X on Instagram and subscribe on YouTube/);
    expect(closingLine('hinglish', 'X', ['youtube'])).toBe('Aise aur videos ke liye X ko subscribe karo.');
    expect(closingLine('hi', 'X', ['youtube'])).toMatch(/सब्सक्राइब/);
  });
});
