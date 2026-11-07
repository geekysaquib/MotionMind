import { styleOf, type StyleId } from '../script';
import type { StyleKit } from './common';
import { liveMap } from './liveMap';
import { whiteboard } from './whiteboard';
import { darkKeynote } from './darkKeynote';
import { transitMap } from './transitMap';
import { newsroom } from './newsroom';

export const KITS: Record<StyleId, StyleKit> = {
  'live-map': liveMap,
  whiteboard,
  'dark-keynote': darkKeynote,
  'transit-map': transitMap,
  newsroom,
};

export const kitFor = (id: string | undefined | null): StyleKit => KITS[styleOf(id)];
