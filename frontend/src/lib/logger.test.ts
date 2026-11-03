import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger, MAX_ENTRIES, sanitize, type LogEntry } from './logger';

function memStorage() {
  const m = new Map<string, string>();
  return { map: m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}
const quietConsole = () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() });

describe('Logger', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('records entries in order and prints them with a scope prefix', () => {
    const out = quietConsole();
    const log = new Logger({ console: out });
    log.info('auth', 'Signed in', { userId: 'u1' });
    log.error('api', 'GET /projects failed');
    expect(log.all().map((e) => [e.level, e.scope, e.msg])).toEqual([
      ['info', 'auth', 'Signed in'],
      ['error', 'api', 'GET /projects failed'],
    ]);
    expect(out.info).toHaveBeenCalledWith('[MotionMind:auth] Signed in', { userId: 'u1' });
    expect(out.error).toHaveBeenCalledWith('[MotionMind:api] GET /projects failed');
  });

  it('skips debug entries unless debug is on', () => {
    const log = new Logger({ console: quietConsole() });
    log.debug('api', 'GET /keys');
    expect(log.all()).toHaveLength(0);
    log.setDebug(true);
    log.debug('api', 'GET /keys');
    expect(log.all()).toHaveLength(1);
  });

  it('filters by minimum level', () => {
    const log = new Logger({ console: quietConsole(), debug: true });
    (['debug', 'info', 'warn', 'error'] as const).forEach((l) => log[l]('x', l));
    expect(log.all('warn').map((e) => e.level)).toEqual(['warn', 'error']);
  });

  it('never records secrets', () => {
    const log = new Logger({ console: quietConsole() });
    log.info('auth', 'x', { accessToken: 'abc', nested: { apiKey: 'sk-1', ok: 1 }, Authorization: 'Bearer t', code: '123456' });
    expect(JSON.stringify(log.all())).not.toMatch(/abc|sk-1|Bearer t|123456/);
    expect(log.all()[0]?.data).toEqual({ accessToken: '[hidden]', nested: { apiKey: '[hidden]', ok: 1 }, Authorization: '[hidden]', code: '[hidden]' });
  });

  it(`keeps only the last ${MAX_ENTRIES} entries`, () => {
    const log = new Logger({ console: quietConsole() });
    for (let i = 0; i < MAX_ENTRIES + 25; i++) log.info('x', `n${i}`);
    expect(log.all()).toHaveLength(MAX_ENTRIES);
    expect(log.all()[0]?.msg).toBe('n25');
  });

  it('survives a reload through storage, and clear() empties it', () => {
    const storage = memStorage();
    new Logger({ storage, console: quietConsole() }).warn('ui', 'before reload');
    const reloaded = new Logger({ storage, console: quietConsole() });
    expect(reloaded.all().map((e) => e.msg)).toEqual(['before reload']);
    reloaded.clear();
    expect(new Logger({ storage, console: quietConsole() }).all()).toHaveLength(0);
  });

  it('keeps working when storage is broken or full', () => {
    const broken = {
      getItem: () => '{not json',
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    const log = new Logger({ storage: broken, console: quietConsole() });
    expect(() => log.error('x', 'still logs')).not.toThrow();
    expect(log.all()).toHaveLength(1);
  });

  it('reports warnings and errors in batches, not info', () => {
    const sent: LogEntry[][] = [];
    const log = new Logger({ console: quietConsole(), report: (b) => sent.push(b), reportDelayMs: 1000 });
    log.info('x', 'not reported');
    log.warn('x', 'w1');
    log.error('x', 'e1');
    expect(sent).toHaveLength(0);
    jest.advanceTimersByTime(1000);
    expect(sent.map((b) => b.map((e) => e.msg))).toEqual([['w1', 'e1']]);
  });

  it('sends right away once 20 entries are waiting, and on flush()', () => {
    const sent: LogEntry[][] = [];
    const log = new Logger({ console: quietConsole(), report: (b) => sent.push(b) });
    for (let i = 0; i < 20; i++) log.error('x', `e${i}`);
    expect(sent).toHaveLength(1);
    log.warn('x', 'last');
    log.flush();
    expect(sent[1]?.map((e) => e.msg)).toEqual(['last']);
  });

  it('a failing reporter never breaks logging', () => {
    const log = new Logger({
      console: quietConsole(),
      report: () => {
        throw new Error('offline');
      },
    });
    log.error('x', 'boom');
    expect(() => log.flush()).not.toThrow();
  });

  it('notifies subscribers and formats a text report', () => {
    const log = new Logger({ console: quietConsole(), now: () => new Date('2026-11-03T10:00:00Z') });
    const fn = jest.fn();
    const off = log.subscribe(fn);
    log.warn('api', 'slow', { ms: 900 });
    off();
    log.warn('api', 'ignored by the unsubscribed listener');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(log.toText().split('\n')[0]).toBe('2026-11-03T10:00:00.000Z WARN  [api] slow {"ms":900}');
  });
});

describe('sanitize', () => {
  it('turns errors into plain objects and shortens long strings', () => {
    const out = sanitize({ err: new TypeError('bad'), long: 'x'.repeat(600) }) as { err: { name: string; message: string }; long: string };
    expect(out.err).toMatchObject({ name: 'TypeError', message: 'bad' });
    expect(out.long.length).toBe(501);
  });

  it('caps deep nesting and long arrays', () => {
    const deep = { a: { b: { c: { d: { e: 1 } } } } };
    expect(JSON.stringify(sanitize(deep))).toContain('[…]');
    expect((sanitize(Array.from({ length: 50 }, (_, i) => i)) as number[]).length).toBe(20);
  });
});
