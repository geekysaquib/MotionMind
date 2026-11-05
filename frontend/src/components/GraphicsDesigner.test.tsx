import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReelScript } from '@motionmind/shared';
import { GraphicsDesigner, ScoreBadge, scoreTone } from './GraphicsDesigner';

const beat = (id: string, narration: string, headline: string, scene?: ReelScript['beats'][number]['scene']) => ({ id, narration, keywords: [], chapter: 1, card: { eyebrow: 'Step', headline, tone: 'teal' as const, rows: [] }, ...(scene ? { scene } : {}) });

const SCRIPT: ReelScript = {
  title: 'IRCTC',
  steps: ['A'],
  glossary: [{ short: 'PRS', full: 'Passenger Reservation System' }],
  beats: [
    beat('a', 'Tumhara phone IRCTC ko request bhejta hai.', 'Tap *Book*', { props: [{ id: 'x', kind: 'custom', glyph: 'sparkles', icon: '💡', shape: 'block' }] }),
    beat('b', 'PRS seat check karta hai.', 'The *PRS* checks seats'),
  ],
};

describe('scoreTone', () => {
  it('calls a high score strong and a low one weak', () => {
    expect(scoreTone(90).label).toBe('Strong');
    expect(scoreTone(70).label).toBe('Good');
    expect(scoreTone(30).label).toBe('Weak');
  });
  it('shows the score on its badge', () => {
    render(<ScoreBadge score={42} />);
    expect(screen.getByText(/Weak · 42/)).toBeTruthy();
  });
});

describe('GraphicsDesigner', () => {
  it('designs the scenes from the words, adds the companies it found, and says what changed', () => {
    const onChange = jest.fn<(s: ReelScript) => void>();
    render(<GraphicsDesigner script={SCRIPT} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Redesign every scene' }));
    fireEvent.click(screen.getByRole('button', { name: /Design graphics/ }));
    const next = onChange.mock.calls[0]![0];
    expect(next.beats[0]!.scene!.props.some((p) => p.logo === 'irctc.co.in')).toBe(true);
    expect(next.beats[1]!.scene!.props.length).toBeGreaterThan(0);
    expect(next.brands?.map((b) => b.name)).toContain('IRCTC');
    expect(next.beats[0]!.card.headline).toBe('Tap *Book*'); // the words are never touched
    expect(screen.getByRole('status').textContent).toMatch(/Designed \d of 2 scenes/);
  });

  it('fills only empty scenes in fill mode, leaving the scene the user made as it was', () => {
    const onChange = jest.fn<(s: ReelScript) => void>();
    render(<GraphicsDesigner script={SCRIPT} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Fill empty scenes' }));
    fireEvent.click(screen.getByRole('button', { name: /Design graphics/ }));
    const next = onChange.mock.calls[0]![0];
    expect(next.beats[0]!.scene).toBe(SCRIPT.beats[0]!.scene);
    expect(next.beats[1]!.scene!.props.length).toBeGreaterThan(0);
  });
});
