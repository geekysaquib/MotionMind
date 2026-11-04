import { makeAutoObservable } from 'mobx';

/** How the user gets AI work done: copy prompts into claude.ai and paste answers back, or the server's API keys. */
export type AiMode = 'paste' | 'keys';

const KEY = 'motionmind-ai-mode';

function read(): { mode: AiMode; explicit: boolean } {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === 'keys' || v === 'paste') return { mode: v, explicit: true };
  } catch {
    /* storage blocked: fall back to the default */
  }
  return { mode: 'paste', explicit: false };
}

function remember(mode: AiMode) {
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    /* the choice still applies for this visit */
  }
}

/**
 * The user's choice between copy-paste and API keys. Most people have no key, so copy-paste is the default.
 * It is saved on the account (the profile) so it follows them to another browser, and kept in this browser's
 * localStorage so it applies instantly and before sign-in. Every stage reads it and shows only the chosen way.
 */
export class AiModeStore {
  mode: AiMode;
  private explicit: boolean;

  /** `save` stores a choice on the account; it is called only when the user picks a mode. */
  constructor(private readonly save: (mode: AiMode) => void = () => undefined) {
    const r = read();
    this.mode = r.mode;
    this.explicit = r.explicit;
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get paste() {
    return this.mode === 'paste';
  }

  /** The user picks a mode: applied now, remembered in this browser, and saved on the account. */
  set(mode: AiMode) {
    this.mode = mode;
    this.explicit = true;
    remember(mode);
    this.save(mode);
  }

  /**
   * The account's saved choice arrived (after sign-in). The account wins; an account that has not chosen yet gets
   * this browser's earlier choice, if there was one.
   */
  adopt(accountMode: AiMode | null | undefined) {
    if (accountMode) {
      this.mode = accountMode;
      this.explicit = true;
      remember(accountMode);
    } else if (this.explicit) {
      this.save(this.mode);
    }
  }
}
