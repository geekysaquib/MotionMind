import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import type { Project } from '@motionmind/shared';
import type { ClaudeService } from '../services/claudeHttp';
import { makeStore, renderWithStore } from '../test-utils';
import { TerminalProject } from './TerminalProject';
import { TerminalHome } from './TerminalHome';

const SCRIPT = { title: 'UPI', steps: ['App'], beats: [{ id: 'a', narration: 'Ek do teen.', keywords: [], chapter: 0, card: { eyebrow: '', headline: 'h', tone: 'teal' as const, rows: [] } }] };

async function setup(path: string, extra: Partial<ClaudeService> = {}) {
  const store = await makeStore({ signedIn: true });
  const project = await store.projects.create({ title: 'UPI', topic: 'How UPI works', durationSec: 30, qualityTier: 'draft' });
  const writeText = jest.fn(async (_t: string) => {});
  Object.assign(navigator, { clipboard: { writeText } });
  store.services.claude = () => ({ editorFor: async () => ({ editor: null, urls: {} }), ...extra }) as unknown as ClaudeService;
  await act(async () => {
    renderWithStore(
      <Routes>
        <Route path="/t" element={<TerminalHome />} />
        <Route path="/t/p/:id/:step?" element={<TerminalProject />} />
      </Routes>,
      store,
      path.replace(':id', project.id),
    );
  });
  return { store, project, writeText };
}

describe('Motion Mind Terminal', () => {
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('lists the reels on Home, each at its next step', async () => {
    await setup('/t');
    expect(screen.getAllByText('UPI').length).toBeGreaterThan(0);
    expect(screen.getByText(/next: research/)).toBeTruthy();
  });

  it('copies the research prompt with the picked approach, and imports the pasted answer', async () => {
    const researchPrompt = jest.fn(async () => 'RESEARCH PROMPT');
    const { writeText } = await setup('/t/p/:id/research', { researchPrompt });
    fireEvent.click(screen.getByRole('button', { name: 'Theory in depth' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Copy prompt/ }));
    });
    expect(researchPrompt).toHaveBeenLastCalledWith(expect.any(String), '', 'theory');
    expect(writeText).toHaveBeenCalledWith('RESEARCH PROMPT');
    expect(screen.getByRole('button', { name: /Copied/ })).toBeTruthy();
  });

  it('joins an animation pasted in parts, in order', async () => {
    let got = '';
    const importAnimation = jest.fn(async (_id: string, text: string) => {
      got = text;
      return { id: 'x' } as unknown as Project;
    });
    const { store, project } = await setup('/t/p/:id/animate', { importAnimation, animationPrompt: async () => 'A' });
    // The animate step needs a script.
    await act(async () => {
      store.projects.upsert({ ...project, script: SCRIPT } as unknown as Project);
    });
    fireEvent.change(screen.getByLabelText("Claude's answer"), { target: { value: '```html\n<!doctype html><html>' } });
    fireEvent.click(screen.getByRole('button', { name: /Add the next part/ }));
    fireEvent.change(screen.getByLabelText('Answer part 2'), { target: { value: '```html\n</html>\n```' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use this answer' }));
    });
    expect(got).toBe('```html\n<!doctype html><html>\n```html\n</html>\n```');
  });
});
