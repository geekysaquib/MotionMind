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
  it('shows at most two short forms', () => {
    const b = beat({ narration: 'OTP aur UPI aur PRS.', headline: 'Pay' });
    expect(termsFor(b, GLOSSARY)).toHaveLength(2);
  });
});

describe('brandsFor and logoUrl', () => {
  const BRANDS = [
    { name: 'NPCI', domain: 'https://www.npci.org.in/' },
    { name: 'Paytm', domain: 'paytm.com' },
  ];
  it('finds brands named in the text, with a clean website', () => {
    expect(brandsFor(beat({ narration: 'NPCI confirms.' }), BRANDS)).toEqual([{ name: 'NPCI', domain: 'npci.org.in' }]);
    expect(brandsFor(beat({ narration: 'Paytm se.' }), BRANDS)).toEqual([{ name: 'Paytm', domain: 'paytm.com' }]);
    expect(brandsFor(beat({ narration: 'Nothing.' }), BRANDS)).toEqual([]);
  });
  it('builds the logo address on the API, with the name for the fallback tile', () => {
    expect(logoUrl('http://localhost:8787/', 'https://www.irctc.co.in', 'IRCTC')).toBe('http://localhost:8787/api/logo/irctc.co.in?name=IRCTC');
    expect(logoUrl(undefined, 'paytm.com')).toBe('/api/logo/paytm.com');
  });
});
