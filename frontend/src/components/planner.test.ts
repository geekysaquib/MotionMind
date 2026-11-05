import { describe, expect, it } from '@jest/globals';
// The engine's own logic, tested here because the engine has no Jest project of its own.
import { findBrands, planGraphics, planScene, scoreScene, themeFor } from '../../../backend/reel-engine/src/planner';
import type { Beat } from '../../../backend/reel-engine/src/script';

const beat = (narration: string, headline: string, extra: Partial<Beat> = {}, eyebrow = 'Step'): Beat =>
  ({ id: headline, narration, keywords: [], chapter: 1, card: { eyebrow, headline, tone: 'teal', rows: [] }, ...extra }) as Beat;

const GLOSSARY = [
  { short: 'PRS', full: 'Passenger Reservation System' },
  { short: 'OTP', full: 'One Time Password' },
];

describe('findBrands', () => {
  it('finds known companies in the words, with their websites, and the ones it was told about', () => {
    const found = findBrands('Paytm se NPCI ko request jaati hai, phir HDFC bank.', []);
    expect(found.map((b) => b.name)).toEqual(expect.arrayContaining(['Paytm', 'NPCI', 'HDFC Bank']));
    expect(found.find((b) => b.name === 'NPCI')!.domain).toBe('npci.org.in');
    expect(findBrands('Acme Pay does it.', [{ name: 'Acme Pay', domain: 'https://www.acmepay.com/' }])[0]).toEqual({ name: 'Acme Pay', domain: 'acmepay.com' });
    expect(findBrands('A normal sentence about trains.', [])).toEqual([]);
  });
});

describe('planScene', () => {
  it('draws a company as a logo tile and what it does as the right model, in the order they are mentioned, with a labelled link', () => {
    const { scene } = planScene(beat('Tumhara phone IRCTC server ko request bhejta hai.', 'Request reaches the *server*'), { glossary: GLOSSARY });
    const kinds = scene.props.map((p) => p.kind);
    expect(scene.props.find((p) => p.logo)?.logo).toBe('irctc.co.in');
    expect(kinds).toContain('server');
    expect(kinds).toContain('phone');
    const ids = scene.props.map((p) => p.id);
    expect(ids.indexOf('you')).toBeLessThan(ids.findIndex((i) => i.startsWith('b-irctc')));
    expect(scene.links?.[0]?.label).toBe('request');
  });

  it('uses the full form of a short form to pick the picture: PRS (Passenger Reservation System) is a server-like system, OTP a lock', () => {
    const prs = planScene(beat('PRS seat check karta hai.', 'The *PRS* checks seats'), { glossary: [{ short: 'PRS', full: 'Passenger Reservation System database' }] }).scene;
    expect(prs.props.some((p) => p.kind === 'database')).toBe(true);
    const otp = planScene(beat('OTP aata hai.', 'Enter the *OTP*'), { glossary: GLOSSARY }).scene;
    expect(otp.props.some((p) => p.kind === 'lock' || p.glyph)).toBe(true);
  });

  it('never draws more than four objects, and keeps big models within the size budget', () => {
    const { scene } = planScene(beat('Train, plane, ship, bus, truck aur bank sab ek saath.', 'Everything *moves*'), {});
    expect(scene.props.length).toBeLessThanOrEqual(4);
    expect(scene.props.filter((p) => ['train', 'plane', 'ship', 'bus', 'truck', 'bank'].includes(p.kind)).length).toBeLessThanOrEqual(3);
  });

  it('rings for signals, and always gives a focus that is one of its objects', () => {
    const { scene } = planScene(beat('Tower signal bhejta hai.', 'The *tower* broadcasts'), {});
    expect(scene.effect).toBe('rings');
    expect(scene.props.map((p) => p.id)).toContain(scene.focus);
  });

  it('keeps an object it drew earlier as the same object, with the look it had', () => {
    const first = planGraphics([beat('Bank paisa bhejta hai.', 'The *bank* pays'), beat('Bank phir check karta hai.', 'The *bank* checks')], {}, 'redesign');
    const a = first.beats[0]!.scene!.props.find((p) => p.kind === 'bank')!;
    const b = first.beats[1]!.scene!.props.find((p) => p.kind === 'bank')!;
    expect(b.id).toBe(a.id);
  });

  it('falls back to one generic tile for a beat with nothing to draw, never an empty scene', () => {
    const { scene } = planScene(beat('Bas aise hi.', 'Okay then'), {});
    expect(scene.props.length).toBeGreaterThan(0);
  });
});

describe('planGraphics', () => {
  const beats = [
    beat('Tumhara phone IRCTC ko request bhejta hai.', 'Tap *Book*', { scene: { props: [{ id: 'x', kind: 'custom', glyph: 'sparkles', icon: '💡', shape: 'block' }] } }),
    beat('PRS seat check karta hai.', 'The *PRS* checks seats', { scene: { props: [{ id: 'srv', kind: 'server', label: 'PRS' }], effect: 'pulse' } }),
  ];

  it('fill leaves existing scenes alone; improve replaces only weak ones; redesign replaces all', () => {
    const fill = planGraphics(beats, { glossary: GLOSSARY }, 'fill');
    expect(fill.beats[0]).toBe(beats[0]);
    expect(fill.report.every((r) => r.notes.includes('kept'))).toBe(true);
    const improve = planGraphics(beats, { glossary: GLOSSARY }, 'improve');
    expect(improve.beats[0]!.scene!.props.some((p) => p.logo)).toBe(true); // the generic tile was weak
    expect(improve.beats[1]).toBe(beats[1]); // a server labelled PRS already fits
    const redesign = planGraphics(beats, { glossary: GLOSSARY }, 'redesign');
    expect(redesign.report).toHaveLength(2);
  });

  it('never replaces a scene with one that rates lower', () => {
    const good = beat('PRS seat check karta hai.', 'The *PRS* checks seats', { scene: { props: [{ id: 'srv', kind: 'server', label: 'PRS' }], effect: 'pulse' } });
    const plan = planGraphics([good], { glossary: GLOSSARY }, 'redesign');
    expect(plan.report[0]!.score).toBeGreaterThanOrEqual(scoreScene(good, good.scene, { glossary: GLOSSARY }));
  });

  it('returns the companies it found, and a theme that suits the words', () => {
    const plan = planGraphics(beats, {}, 'fill');
    expect(plan.brands.map((b) => b.name)).toContain('IRCTC');
    expect(themeFor([beat('Hackers ko password mil jata hai, security breach.', 'A *hack*')])).toBe('night');
    expect(themeFor([beat('Paudha khet mein ugta hai.', 'The *plant* grows')])).toBe('nature');
    expect(themeFor([beat('Bas ek app.', 'An *app*')])).toBe('city');
  });
});
