import { describe, expect, it } from '@jest/globals';
import { parseProgress, run } from './hyperframes';

describe('parseProgress', () => {
  it("reads HyperFrames' machine-readable progress lines and ignores the rest", () => {
    expect(parseProgress('@hf-progress {"code":"capture","done":20,"total":90,"pct":35}')).toEqual({ code: 'capture', done: 20, total: 90, pct: 35 });
    expect(parseProgress('  ████░░  35%  Capturing frame 20/90 (3 workers)')).toBeNull();
    expect(parseProgress('@hf-progress {broken')).toBeNull();
  });
});

describe('run', () => {
  it('stops a tool that goes silent, and says so', async () => {
    const r = await run(process.execPath, ['-e', 'console.log("hi"); setTimeout(() => {}, 60000)'], process.cwd(), undefined, { idleMs: 800 });
    expect(r.timedOut).toBe('idle');
    expect(r.code).toBe(-1);
  }, 20000);

  it('passes every output line on', async () => {
    const lines: string[] = [];
    const r = await run(process.execPath, ['-e', 'console.log("a"); console.log("b")'], process.cwd(), (l) => lines.push(l));
    expect(r.code).toBe(0);
    expect(lines).toEqual(['a', 'b']);
  });
});
