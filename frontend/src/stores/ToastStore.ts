import { makeAutoObservable } from 'mobx';

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
    const id = ++this.seq;
    this.items.push({ id, tone, text });
    setTimeout(() => this.dismiss(id), ms);
  }

  dismiss(id: number) {
    this.items = this.items.filter((t) => t.id !== id);
  }
}
