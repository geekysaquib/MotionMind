import { describe, expect, it } from '@jest/globals';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { STYLE_IDS } from '@motionmind/shared';
import { STYLE_FILMS } from './styleFilms';
import { STYLE_SAMPLE_HTML } from './styleSamples';

describe('style samples', () => {
  it('gives every style exactly one sample: a film with a still, or a drawn preview', () => {
    for (const id of STYLE_IDS) {
      const film = Boolean(STYLE_FILMS[id]);
      expect([id, film || Boolean(STYLE_SAMPLE_HTML[id])]).toEqual([id, true]);
      expect([id, film && Boolean(STYLE_SAMPLE_HTML[id])]).toEqual([id, false]);
      if (film) expect([id, existsSync(path.join(process.cwd(), 'frontend', 'public', 'style-films', `${id}.jpg`))]).toEqual([id, true]);
    }
  });
});
