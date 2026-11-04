/**
 * UI logs: what the app did, in order, so a problem can be understood after the fact.
 *
 * - Every entry goes to the browser console with a [MotionMind:scope] prefix.
 * - The last MAX_ENTRIES are kept in localStorage, so they survive a crash and reload.
 *   See them in Settings > Diagnostics (copy or download them for a bug report).
 * - Errors are also sent to the API (/api/client-logs), so they show up in the API terminal.
 * - Values under sensitive keys (tokens, API keys, codes, passwords) are never recorded.
 * - Debug entries are recorded only in development or after `localStorage.motionmind-debug = '1'`.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  /** ISO time */
  t: string;
  level: LogLevel;
  /** Area of the app, such as api, auth, router, ui */
  scope: string;
  msg: string;
  data?: Record<string, unknown>;
}

export const MAX_ENTRIES = 300;
const STORAGE_KEY = 'motionmind-logs';
const DEBUG_KEY = 'motionmind-debug';
const SENSITIVE = /token|authorization|apikey|api_key|password|secret|code|otp/i;
const RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

interface Sink {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export interface LoggerOptions {
  storage?: Sink | null;
  console?: Pick<Console, 'debug' | 'info' | 'warn' | 'error'>;
  /** Called with batches of warn/error entries. Wired to the API in main.tsx. */
  report?: (entries: LogEntry[]) => void;
  reportDelayMs?: number;
  debug?: boolean;
  now?: () => Date;
}

/** Copies data, replacing sensitive values, shortening long strings and turning Errors into plain objects. */
export function sanitize(value: unknown, depth = 0): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, ...(value.stack ? { stack: value.stack.split('\n').slice(0, 6).join('\n') } : {}) };
  if (typeof value === 'string') return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  if (value === null || typeof value !== 'object') return value;
  if (depth > 3) return '[…]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? '[hidden]' : sanitize(v, depth + 1);
  return out;
}

export class Logger {
  private entries: LogEntry[] = [];
  private listeners = new Set<() => void>();
  private pending: LogEntry[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly storage: Sink | null;
  private readonly out: NonNullable<LoggerOptions['console']>;
  private readonly now: () => Date;
  private reporter: LoggerOptions['report'];
  debugEnabled: boolean;

  constructor(private readonly opts: LoggerOptions = {}) {
    this.storage = opts.storage ?? null;
    this.out = opts.console ?? console;
    this.now = opts.now ?? (() => new Date());
    this.reporter = opts.report;
    this.debugEnabled = opts.debug ?? this.storage?.getItem(DEBUG_KEY) === '1';
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (raw) this.entries = (JSON.parse(raw) as LogEntry[]).slice(-MAX_ENTRIES);
    } catch {
      this.entries = [];
    }
  }

  debug(scope: string, msg: string, data?: Record<string, unknown>) {
    this.write('debug', scope, msg, data);
  }
  info(scope: string, msg: string, data?: Record<string, unknown>) {
    this.write('info', scope, msg, data);
  }
  warn(scope: string, msg: string, data?: Record<string, unknown>) {
    this.write('warn', scope, msg, data);
  }
  error(scope: string, msg: string, data?: Record<string, unknown>) {
    this.write('error', scope, msg, data);
  }

  /** Oldest first. */
  all(minLevel: LogLevel = 'debug'): LogEntry[] {
    return this.entries.filter((e) => RANK[e.level] >= RANK[minLevel]);
  }

  clear() {
    this.entries = [];
    this.persist();
    this.emit();
  }

  setDebug(on: boolean) {
    this.debugEnabled = on;
    try {
      this.storage?.setItem(DEBUG_KEY, on ? '1' : '');
    } catch {
      /* storage blocked */
    }
  }

  /** Where warn/error entries are sent in batches. */
  setReporter(report: LoggerOptions['report']) {
    this.reporter = report;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Plain text for pasting into a bug report. */
  toText(): string {
    return this.entries.map((e) => `${e.t} ${e.level.toUpperCase().padEnd(5)} [${e.scope}] ${e.msg}${e.data ? ` ${JSON.stringify(e.data)}` : ''}`).join('\n');
  }

  /** Sends anything still waiting to be reported right away (used when the page is closing). */
  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.pending.length || !this.reporter) return;
    const batch = this.pending.splice(0, this.pending.length);
    try {
      this.reporter(batch);
    } catch {
      /* reporting must never break the app */
    }
  }

  private write(level: LogLevel, scope: string, msg: string, data?: Record<string, unknown>) {
    if (level === 'debug' && !this.debugEnabled) return;
    const entry: LogEntry = { t: this.now().toISOString(), level, scope, msg, ...(data ? { data: sanitize(data) as Record<string, unknown> } : {}) };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    this.persist();
    this.out[level](`[MotionMind:${scope}] ${msg}`, ...(entry.data ? [entry.data] : []));
    if (RANK[level] >= RANK.warn && this.reporter) {
      this.pending.push(entry);
      if (this.pending.length >= 20) this.flush();
      else if (!this.timer) this.timer = setTimeout(() => this.flush(), this.opts.reportDelayMs ?? 2000);
    }
    this.emit();
  }

  private persist() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      /* full or blocked storage: keep logging in memory */
    }
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }
}

function browserStorage(): Sink | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** The app-wide logger. main.tsx connects reporting and the global error handlers. */
export const log = new Logger({ storage: browserStorage(), debug: import.meta.env?.DEV || undefined });
