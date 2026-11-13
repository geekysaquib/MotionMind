import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { Project, ReelScript } from '@motionmind/shared';
import type { ClaudeService, LayoutCheck as Result } from '../services/claudeHttp';
import { makeStore, renderWithStore } from '../test-utils';
import { LayoutCheck } from './LayoutCheck';

const SCRIPT: ReelScript = { title: 'T', steps: ['a'], beats: [{ id: 'a', narration: 'Ek.', keywords: [], chapter: 0, card: { eyebrow: 'E', headline: 'H', tone: 'teal', rows: [] } }], animation: { html: '<html></html>', timingKey: 'x', writtenAt: '2026-11-12T00:00:00Z' } };

async function setup(checkLayout: ClaudeService['checkLayout']) {
  const store = await makeStore({ signedIn: true });
  const created = await store.projects.create({ title: 'T', topic: 'T', durationSec: 30, qualityTier: 'draft' });
  const project: Project = { ...created, script: SCRIPT };
  store.services.claude = () => ({ checkLayout }) as unknown as ClaudeService;
  const writeText = jest.fn(async (_t: string) => {});
  Object.assign(navigator, { clipboard: { writeText } });
  await act(async () => {
    renderWithStore(<LayoutCheck project={project} />, store);
  });
  return { writeText };
}

describe('LayoutCheck', () => {
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('checks the new animation on its own and lists the problems with a request to paste into Claude', async () => {
    const result: Result = { report: { ok: false, total: 1, issues: [{ code: 'text_occluded', time: 3.2, text: 'PNR 4857', message: 'Text is hidden beneath an opaque element.', seconds: 2 }] }, request: 'Fix: PNR 4857 is hidden' };
    const check = jest.fn(async () => result);
    const { writeText } = await setup(check);
    expect(check).toHaveBeenCalledTimes(1);
    expect(screen.getByText('1 to fix')).toBeTruthy();
    expect(screen.getByText('3.2 s')).toBeTruthy();
    expect(screen.getAllByText(/PNR 4857/).length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy fix request/ }));
    });
    expect(writeText).toHaveBeenCalledWith('Fix: PNR 4857 is hidden');
  });

  it('says so when nothing is wrong, and shows why a check could not run', async () => {
    await setup(async () => ({ report: { ok: true, total: 0, issues: [] }, request: null }));
    expect(screen.getByText('Clean')).toBeTruthy();
    cleanup();
    await setup(async () => {
      throw new Error('The layout check runs on your PC: start Motion Mind with npm run dev.');
    });
    expect(screen.getByText(/runs on your PC/)).toBeTruthy();
  });
});
