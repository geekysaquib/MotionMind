import { makeAutoObservable, runInAction } from 'mobx';
import { PROVIDERS, type KeyTestResult, type ProviderId, type StoredKeySummary } from '@motionmind/shared';
import type { RootStore } from './RootStore';

export class KeysStore {
  keys = new Map<ProviderId, StoredKeySummary>();
  loaded = false;
  error: string | null = null;
  busy = new Set<ProviderId>();
  lastResult = new Map<ProviderId, KeyTestResult>();

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  private get svc() {
    return this.root.services.keys(() => this.root.auth.session?.accessToken ?? null);
  }

  get configuredCount() {
    return this.keys.size;
  }

  get rows() {
    return PROVIDERS.map((id) => ({ id, key: this.keys.get(id) ?? null, busy: this.busy.has(id), result: this.lastResult.get(id) ?? null }));
  }

  async load() {
    try {
      const list = await this.svc.list();
      runInAction(() => {
        this.keys = new Map(list.map((k) => [k.provider, k]));
        this.loaded = true;
        this.error = null;
      });
    } catch (e) {
      runInAction(() => {
        this.error = (e as Error).message;
        this.loaded = true;
      });
    }
  }

  clear() {
    this.keys.clear();
    this.lastResult.clear();
    this.loaded = false;
  }

  private async withBusy<T>(id: ProviderId, fn: () => Promise<T>) {
    this.busy.add(id);
    try {
      return await fn();
    } finally {
      runInAction(() => this.busy.delete(id));
    }
  }

  save(id: ProviderId, apiKey: string) {
    return this.withBusy(id, async () => {
      const k = await this.svc.save(id, apiKey);
      runInAction(() => {
        this.keys.set(id, k);
        this.lastResult.delete(id);
      });
    });
  }

  remove(id: ProviderId) {
    return this.withBusy(id, async () => {
      await this.svc.remove(id);
      runInAction(() => {
        this.keys.delete(id);
        this.lastResult.delete(id);
      });
    });
  }

  test(id: ProviderId) {
    return this.withBusy(id, async () => {
      const { result } = await this.svc.test(id);
      runInAction(() => {
        this.lastResult.set(id, result);
        const k = this.keys.get(id);
        if (k) this.keys.set(id, { ...k, lastTestOk: result.ok, lastTestedAt: new Date().toISOString() });
      });
      return result;
    });
  }
}
