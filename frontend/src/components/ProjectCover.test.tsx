import { afterEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, screen } from '@testing-library/react';
import type { Project, ReelScript } from '@motionmind/shared';
import { makeStore, renderWithStore } from '../test-utils';
import { ProjectCover } from './ProjectCover';

const SCRIPT: ReelScript = { title: 'UPI', steps: ['App'], beats: [{ id: 'a', narration: 'Ek.', keywords: [], chapter: 0, card: { eyebrow: 'UPI', headline: 'Fast', tone: 'teal', rows: [] } }] };

async function show(script: ReelScript | null) {
  const store = await makeStore({ signedIn: true });
  const created = await store.projects.create({ title: 'UPI reel', topic: 'UPI', durationSec: 30, qualityTier: 'draft' });
  const project: Project = { ...created, script };
  await act(async () => {
    renderWithStore(
      <ProjectCover project={project} tint="#eee">
        <span>badge</span>
      </ProjectCover>,
      store,
    );
  });
}

describe('ProjectCover', () => {
  afterEach(async () => {
    await act(async () => {});
    cleanup();
  });

  it('says the cover comes with the script when there is none yet, and keeps the badges on top', async () => {
    await show(null);
    expect(screen.getByText('The cover appears once the script is written.')).toBeTruthy();
    expect(screen.getByText('UPI reel')).toBeTruthy();
    expect(screen.getByText('badge')).toBeTruthy();
  });

  it('draws nothing heavy until it scrolls into view (and never where it cannot tell)', async () => {
    await show(SCRIPT);
    expect(screen.queryByText('The cover appears once the script is written.')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('badge')).toBeTruthy();
  });
});
