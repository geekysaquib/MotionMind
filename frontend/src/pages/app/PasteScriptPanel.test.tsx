import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { Project } from '@motionmind/shared';
import { ServiceError } from '../../services/types';
import type { ClaudeService } from '../../services/claudeHttp';
import { makeStore, renderWithStore } from '../../test-utils';
import { PasteScriptPanel } from './PasteScriptPanel';

const SCRIPT = { title: 'UPI', steps: ['App'], beats: [], model: 'claude.ai (pasted)' };

async function setup(importScript: ClaudeService['importScript']) {
  const store = await makeStore({ signedIn: true });
  const project = await store.projects.create({ title: 'UPI', topic: 'How UPI works', durationSec: 30, qualityTier: 'draft' });
  const scriptPrompt = jest.fn(async () => 'PROMPT FOR CLAUDE.AI');
  store.services.claude = () =>
    ({ connectors: async () => [], status: async () => ({ connected: false, model: 'x' }), ask: async () => { throw new Error(); }, writeScript: async () => project, testElevenLabs: async () => ({ ok: true, detail: '' }), scriptPrompt, importScript }) as unknown as ClaudeService;
  const writeText = jest.fn(async (_t: string) => {});
  Object.assign(navigator, { clipboard: { writeText } });
  await act(async () => {
    renderWithStore(<PasteScriptPanel project={project} />, store);
  });
  return { store, project, writeText, scriptPrompt };
}

describe('PasteScriptPanel', () => {
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('copies the prompt for claude.ai', async () => {
    const { writeText, project, scriptPrompt } = await setup(async () => {
      throw new Error('not used');
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
    });
    expect(scriptPrompt).toHaveBeenCalledWith(project.id, null);
    expect(writeText).toHaveBeenCalledWith('PROMPT FOR CLAUDE.AI');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
  });

  it("imports Claude's pasted answer into the project", async () => {
    let p: Project | undefined;
    const { store, project } = await setup(async (id, text) => {
      expect(text).toContain('"title"');
      p = { ...project, id, script: SCRIPT, stage: 'script' };
      return p;
    });
    fireEvent.change(screen.getByLabelText("Claude's answer"), { target: { value: '{"title":"UPI"}' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use this answer' }));
    });
    expect(store.projects.byId(project.id)?.script?.model).toBe('claude.ai (pasted)');
  });

  it('shows why a paste was rejected', async () => {
    await setup(async () => {
      throw new ServiceError("That doesn't look like a script.", 'invalid_script');
    });
    fireEvent.change(screen.getByLabelText("Claude's answer"), { target: { value: 'sorry' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Use this answer' }));
    });
    expect(screen.getByText("That doesn't look like a script.")).toBeTruthy();
  });
});
