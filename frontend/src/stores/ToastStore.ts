import { makeAutoObservable } from 'mobx';
import { log } from '../lib/logger';

export interface Toast {
  id: number;
  tone: 'success' | 'error' | 'info';
  text: string;
}

export class ToastStore {
  items: Toast[] = [];
  private seq = 0;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  push(tone: Toast['tone'], text: string, ms = 4000) {
    // Every error a user sees is in the UI log too, with the page it happened on.
    if (tone === 'error') log.warn('ui', `Error shown to user: ${text}`, { page: typeof location !== 'undefined' ? location.pathname : undefined });
    const id = ++this.seq;
    this.items.push({ id, tone, text });
    setTimeout(() => this.dismiss(id), ms);
  }

  dismiss(id: number) {
    this.items = this.items.filter((t) => t.id !== id);
  }
}
