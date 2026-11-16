import type { StyleId } from '@motionmind/shared';

/**
 * Styles whose rulebook comes from Lemo-Opuscar show that style's own demo film as their sample: the film streams from
 * LemoLab's gallery site (CC BY 4.0, "Lemo-Opuscar by Lemomo (LemoLab)"), and a still of it (public/style-films/<id>.jpg)
 * shows until it plays. Key: our style id; value: the film's name on the gallery.
 */
export const STYLE_FILMS: Partial<Record<StyleId, string>> = {
  'dark-keynote': 'dark-keynote',
  'transit-map': 'transit-map',
  newsroom: 'news-package',
  'map-explainer': 'map-explainer',
  'dark-documentary': 'dark-documentary',
  'briefing-board': 'briefing-board',
  dataviz: 'dataviz',
  'data-physical': 'data-physical',
  teardown: 'teardown',
  'security-xray': 'security-xray',
  'white-model': 'white-model',
  'isometric-picture-book': 'isometric-picture-book',
  'iso-infographic': 'iso-infographic',
  'lowpoly-island': 'lowpoly-island',
  'tilt-shift': 'tilt-shift',
  'paper-lantern': 'paper-lantern',
  'silkscreen-poster': 'silkscreen-poster',
  'city-symphony': 'city-symphony',
  telestrator: 'telestrator',
};

export const styleFilmUrl = (film: string) => `https://lemomo-ai.github.io/lemo-opuscar-films/${film}.mp4`;
export const styleFilmPoster = (id: StyleId) => `/style-films/${id}.jpg`;
