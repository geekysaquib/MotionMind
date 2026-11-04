import { afterEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { ClaudeService, Connector } from '../../services/claudeHttp';
import { makeStore, renderWithStore } from '../../test-utils';
import { ConnectorsSettings } from './ConnectorsSettings';

function fakeService(connectors: Connector[]): ClaudeService {
  return {
    connectors: async () => connectors,
    status: async () => ({ connected: true, model: 'claude-opus-5-5' }),
    ask: async (prompt) => ({ reply: { text: `You asked: ${prompt.slice(0, 20)}`, model: 'claude-opus-5-5', inputTokens: 9, outputTokens: 4 }, ms: 1200 }),
    writeScript: async () => {
      throw new Error('not used');
    },
    testElevenLabs: async () => ({ ok: true, detail: 'Connected. 2 voices available.', voices: [{ id: 'v1', name: 'Aarav' }, { id: 'v2', name: 'Diya' }] }),
  };
}

const CLAUDE: Connector = { id: 'claude', name: 'Claude', purpose: 'Writes and researches your reel scripts', connected: true, detail: 'claude-opus-5-5' };
const ELEVEN: Connector = { id: 'elevenlabs', name: 'ElevenLabs', purpose: 'Voiceover for your reels', connected: true, detail: null };

async function renderPage(connectors: Connector[]) {
  const store = await makeStore({ signedIn: true });
  store.services.claude = () => fakeService(connectors);
  await act(async () => {
    renderWithStore(<ConnectorsSettings />, store);
  });
}

describe('ConnectorsSettings', () => {
  afterEach(async () => {
    // Let the last state update (busy -> false) settle before unmounting.
    await act(async () => {});
    cleanup();
  });

  it('shows exactly the Claude and ElevenLabs connectors, with no key fields', async () => {
    await renderPage([CLAUDE, ELEVEN]);
    expect(await screen.findByText('Claude')).toBeTruthy();
    expect(screen.getByText('ElevenLabs')).toBeTruthy();
    expect(screen.getAllByText('Ready')).toHaveLength(2);
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it('asks Claude and shows the answer with model and timing', async () => {
    await renderPage([CLAUDE, ELEVEN]);
    fireEvent.click(await screen.findByRole('button', { name: 'Test Claude' }));
    expect((await screen.findByTestId('claude-answer')).textContent).toContain('You asked: In one short');
    expect(screen.getByText(/claude-opus-5-5 · 1\.2s/)).toBeTruthy();
  });

  it('tests ElevenLabs and lists voices', async () => {
    await renderPage([CLAUDE, ELEVEN]);
    fireEvent.click(await screen.findByRole('button', { name: 'Test ElevenLabs' }));
    expect(await screen.findByText('Connected. 2 voices available.')).toBeTruthy();
    expect(screen.getByText('Diya')).toBeTruthy();
  });

  it('explains when a connector is not set up on the server', async () => {
    await renderPage([CLAUDE, { ...ELEVEN, connected: false }]);
    expect(await screen.findByText('Not available')).toBeTruthy();
    expect(screen.getByText(/needs to add ELEVENLABS_API_KEY/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Test ElevenLabs' })).toBeNull();
  });
});
