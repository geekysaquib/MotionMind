import { describe, expect, it } from '@jest/globals';
// The engine's own logic, tested here because the engine has no Jest project of its own.
import { brandsFor, logoUrl, termsFor } from '../../../backend/reel-engine/src/terms';
import type { Beat } from '../../../backend/reel-engine/src/script';

const beat = (over: Partial<Beat> & { headline?: string }): Beat =>
  ({ id: 'a', narration: 'Request reaches PRS.', keywords: [], chapter: 0, card: { eyebrow: 'Step 1', headline: over.headline ?? 'Request reaches the *PRS*', tone: 'teal', rows: [] }, ...over }) as Beat;

const GLOSSARY = [
  { short: 'PRS', full: 'Passenger Reservation System' },
  { short: 'OTP', full: 'One Time Password' },
  { short: 'UPI', full: 'Unified Payments Interface' },
];

describe('termsFor', () => {
  it('shows the full form of a short form the beat uses, and only that one', () => {
    expect(termsFor(beat({}), GLOSSARY)).toEqual([{ short: 'PRS', full: 'Passenger Reservation System' }]);
  });
  it('matches whole words only, so PRS is not found inside another word', () => {
    expect(termsFor(beat({ narration: 'The PRSM team.', headline: 'Team' }), GLOSSARY)).toEqual([]);
  });
  it('skips a short form whose full form is already spelled out on the card', () => {
    expect(termsFor(beat({ headline: 'Passenger Reservation System (PRS)' }), GLOSSARY)).toEqual([]);
  });
  it('finds short forms in scene labels, and shows at most two', () => {
    const b = beat({ narration: 'Ek.', headline: 'Pay', scene: { props: [{ id: 'a', kind: 'phone', label: 'OTP' }, { id: 'b', kind: 'bank', label: 'UPI' }, { id: 'c', kind: 'server', label: 'PRS' }] } });
    expect(termsFor(b, GLOSSARY).map((t) => t.short)).toEqual(['PRS', 'OTP']);
  });
});

describe('brandsFor and logoUrl', () => {
  const BRANDS = [
    { name: 'NPCI', domain: 'https://www.npci.org.in/' },
    { name: 'Paytm', domain: 'paytm.com' },
  ];
  it('finds brands named in the text or drawn as a logo tile, with a clean website', () => {
    expect(brandsFor(beat({ narration: 'NPCI confirms.' }), BRANDS)).toEqual([{ name: 'NPCI', domain: 'npci.org.in' }]);
    const tile = beat({ narration: 'Ek.', scene: { props: [{ id: 'p', kind: 'custom', logo: 'paytm.com' }] } });
    expect(brandsFor(tile, BRANDS)).toEqual([{ name: 'Paytm', domain: 'paytm.com' }]);
    expect(brandsFor(beat({ narration: 'Nothing.' }), BRANDS)).toEqual([]);
  });
  it('builds the logo address on the API, with the name for the fallback tile', () => {
    expect(logoUrl('http://localhost:8787/', 'https://www.irctc.co.in', 'IRCTC')).toBe('http://localhost:8787/api/logo/irctc.co.in?name=IRCTC');
    expect(logoUrl(undefined, 'paytm.com')).toBe('/api/logo/paytm.com');
  });
});
