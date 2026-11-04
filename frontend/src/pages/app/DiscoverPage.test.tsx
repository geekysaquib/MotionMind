import { afterEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { makeStore, renderWithStore } from '../../test-utils';
import { DiscoverPage } from './DiscoverPage';

describe('DiscoverPage', () => {
  afterEach(cleanup);

  it('shows starter ideas by category and opens the new-reel form with the topic filled in', async () => {
    const store = await makeStore({ signedIn: true });
    await act(async () => {
      renderWithStore(<DiscoverPage />, store);
    });
    // Trending now is the first tab; the curated ideas are behind the others.
    fireEvent.click(screen.getByRole('tab', { name: /Payments & money/ }));
    // Each idea links to the dashboard form with its topic.
    const first = screen.getByRole('link', { name: /How does a UPI Soundbox know the money arrived\?/ });
    expect(first.getAttribute('href')).toBe(`/app?new=1&topic=${encodeURIComponent('How does a UPI Soundbox know the money arrived?')}`);

    fireEvent.click(screen.getByRole('tab', { name: /Health & science/ }));
    expect(screen.getByRole('link', { name: /How does a vaccine train your body/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /UPI Soundbox/ })).toBeNull();
  });

  it('says plainly that these are picked ideas, not live trends', async () => {
    const store = await makeStore({ signedIn: true });
    await act(async () => {
      renderWithStore(<DiscoverPage />, store);
    });
    fireEvent.click(screen.getByRole('tab', { name: /Payments & money/ }));
    expect(screen.getByText(/not live trends/)).toBeTruthy();
  });
});
