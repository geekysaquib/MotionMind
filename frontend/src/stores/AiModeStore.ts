import { makeAutoObservable } from 'mobx';

/** How the user gets AI work done: copy prompts into claude.ai and paste answers back, or the server's API keys. */
export type AiMode = 'paste' | 'keys';

const KEY = 'motionmind-ai-mode';

function read(): AiMode {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === 'keys' || v === 'paste') return v;
  } catch {
    /* storage blocked: fall back to the default */
  }
  return 'paste';
}

/**
 * The user's choice between copy-paste and API keys. Most people have no key, so copy-paste is the default.
 * It is kept in this browser's localStorage; every stage reads it and shows only the chosen way.
 */
export class AiModeStore {
  mode: AiMode = read();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get paste() {
    return this.mode === 'paste';
  }

  set(mode: AiMode) {
    this.mode = mode;
    try {
      window.localStorage.setItem(KEY, mode);
    } catch {
      /* the choice still applies for this visit */
    }
  }
}
