import { describe, expect, it } from '@jest/globals';
// The engine's own logic, tested here because the engine has no Jest project of its own.
import { chooseShot, shotPlan, statsIn } from '../../../backend/reel-engine/src/shotplan';
import type { Beat } from '../../../backend/reel-engine/src/script';

const beat = (narration: string, headline: string, rows: unknown[] = [], scene?: Beat['scene']): Beat =>
  ({ id: headline, narration, keywords: [], chapter: 1, card: { eyebrow: 'Step', headline, tone: 'teal', rows }, ...(scene ? { scene } : {}) }) as Beat;

describe('statsIn', () => {
  it('finds numbers with their units and currency, and ignores small bare numbers in prose', () => {
    expect(statsIn('Pehle 32,000/min, ab 1.5 lakh per minute').map((s) => s.value)).toEqual([32000, 1.5]);
    expect(statsIn('₹825 balance')[0]).toMatchObject({ value: 825, prefix: '₹' });
    expect(statsIn('75% load in 30s').map((s) => [s.value, s.suffix.trim()])).toEqual([[75, '%'], [30, 's']]);
    expect(statsIn('Step 2 of teen').length).toBe(0);
    expect(statsIn('1.5 lakh')[0]!.decimals).toBe(1);
  });
});

describe('chooseShot', () => {
  it('opens on a giant question for a question with one object', () => {
    expect(chooseShot(beat('Kyun fail hota hai?', 'Kyun *fail* hota hai?', [], { props: [{ id: 'a', kind: 'server' }] }))).toBe('hero');
  });
  it('compares two labelled values, even when both are numbers', () => {
    expect(chooseShot(beat('Pehle 32,000, ab 1.5 lakh.', '32,000 se *1.5 lakh*', [{ kind: 'kv', k: 'Pehle', v: '32,000' }, { kind: 'kv', k: 'Ab', v: '1.5 lakh' }]))).toBe('compare');
  });
  it('ticks off a list of chips, with a struck-out one', () => {
    expect(chooseShot(beat('Bots roko.', 'Bots ko *roko*', [{ kind: 'chips', items: [{ text: 'Aadhaar' }, { text: 'OTP' }, { text: 'Bot', strike: true }] }], { props: [{ id: 'a', kind: 'person' }, { id: 'b', kind: 'lock' }, { id: 'c', kind: 'server' }], links: [{ from: 'a', to: 'b' }] }))).toBe('checklist');
  });
  it('rolls digits for a long code, fills a ring for a percentage, and counts up a plain number', () => {
    expect(chooseShot(beat('OTP 872921 aata hai.', 'Phone par *OTP*'))).toBe('tiles');
    expect(chooseShot(beat('Server 75% load handle karta hai.', 'Load'), ['ring', 'hero', 'nodes'])).toBe('ring');
    expect(chooseShot(beat('Tatkal 10 baje khulta hai.', 'Tatkal'), ['stat', 'nodes'])).toBe('stat');
  });
  it('types into a screen when the narration says someone types, clicks or logs in', () => {
    expect(chooseShot(beat('Login karte hi command chalta hai.', 'Server ko *command*'), ['ui', 'hero', 'nodes'])).toBe('ui');
  });
  it('draws boxes and arrows for a flow with links, and falls back to them when nothing else fits', () => {
    const flow = beat('Request LB se server tak jaati hai.', 'Request ka *safar*', [], { props: [{ id: 'a', kind: 'loadbalancer' }, { id: 'b', kind: 'server' }, { id: 'c', kind: 'database' }], links: [{ from: 'a', to: 'b', label: 'request' }] });
    expect(chooseShot(flow)).toBe('nodes');
    expect(chooseShot(beat('Bas aise.', 'Okay'), ['nodes'])).toBe('nodes');
  });
  it('only picks from the template\'s own shots', () => {
    expect(chooseShot(beat('Kyun fail hota hai?', 'Kyun *fail*?'), ['nodes', 'stat'])).not.toBe('hero');
  });
});

describe('shotPlan', () => {
  it('varies: the shot just used costs a little, so a close second place wins', () => {
    const b = beat('Tatkal 10 baje khulta hai.', 'Tatkal 10 baje');
    expect(chooseShot(b, ['stat', 'hero'])).toBe('stat');
    expect(chooseShot(b, ['stat', 'hero'], 'stat')).toBe('hero');
    expect(shotPlan([b, b], ['stat', 'hero'])).toEqual(['stat', 'hero']);
  });
});
