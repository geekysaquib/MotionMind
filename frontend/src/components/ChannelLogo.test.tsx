import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { ClaudeService } from '../services/claudeHttp';
import { makeStore, renderWithStore } from '../test-utils';
import { setLogoPreparer } from '../lib/logoImage';
import { ChannelLogo } from './ChannelLogo';

async function setup(initial: string | null = null) {
  const store = await makeStore({ signedIn: true });
  let url = initial;
  const uploaded: Blob[] = [];
  store.services.claude = () =>
    ({
      logo: async () => ({ url }),
      uploadLogo: async (b: Blob) => {
        uploaded.push(b);
        url = 'data:image/png;base64,AAAA';
        return { url };
      },
      removeLogo: jest.fn(async () => {
        url = null;
        return { ok: true };
      }),
    }) as unknown as ClaudeService;
  await act(async () => {
    renderWithStore(<ChannelLogo />, store);
  });
  return { uploaded };
}

describe('ChannelLogo', () => {
  afterEach(async () => {
    setLogoPreparer(null);
    await act(async () => {});
    cleanup();
  });

  it('uploads a resized picture and shows it, then removes it', async () => {
    setLogoPreparer(async () => new Blob(['small'], { type: 'image/png' }));
    const { uploaded } = await setup();
    expect(screen.getByText('No logo yet')).toBeTruthy();
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Logo file'), { target: { files: [file] } });
    });
    expect(uploaded).toHaveLength(1);
    expect(screen.getByAltText('Your channel logo')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    });
    expect(screen.getByText('No logo yet')).toBeTruthy();
  });

  it('refuses a file that is not a PNG, JPEG or WebP', async () => {
    const { uploaded } = await setup();
    await act(async () => {
      fireEvent.change(screen.getByLabelText('Logo file'), { target: { files: [new File(['x'], 'logo.svg', { type: 'image/svg+xml' })] } });
    });
    expect(uploaded).toHaveLength(0);
    expect(screen.getByRole('alert').textContent).toMatch(/PNG, JPEG or WebP/);
  });
});
