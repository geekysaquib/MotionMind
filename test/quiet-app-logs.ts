// Keeps test output readable: the app's own log lines ("[MotionMind:...]" in the browser,
// "[client-log]" and "[dev] Sign-in code" on the server) are checked through the logger or sinks
// in tests, so they don't also need printing. Anything else still prints.
const APP_PREFIXES = ['[MotionMind:', '[client-log]', '[dev] Sign-in code', 'SMTP_HOST is not set', 'API running in MEMORY mode'];

for (const level of ['debug', 'info', 'warn', 'error'] as const) {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && APP_PREFIXES.some((p) => (args[0] as string).startsWith(p))) return;
    // Remotion's own dev warnings when its player renders in jsdom (no AudioContext, internal refs).
    if (args.some((x) => typeof x === 'string' && (x.includes('AbsoluteFillWithTiming') || x.includes('AudioContext is not supported') || x.includes('SequenceManagerActionsContext')))) return;
    original(...args);
  };
}
