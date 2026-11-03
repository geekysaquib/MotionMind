import { makeAutoObservable, runInAction } from 'mobx';
import type { Project } from '@motionmind/shared';
import type { RootStore } from './RootStore';
import type { NewProject } from '../services/types';
import { log } from '../lib/logger';

export class ProjectStore {
  items: Project[] = [];
  loaded = false;
  loading = false;
  error: string | null = null;

  constructor(private readonly root: RootStore) {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get stats() {
    const active = this.items.filter((p) => p.status !== 'archived');
    return {
      total: active.length,
      completed: active.filter((p) => p.status === 'completed').length,
      drafts: active.filter((p) => p.status === 'draft').length,
      inProgress: active.filter((p) => p.status === 'in_progress').length,
    };
  }

  get recent() {
    return this.items.filter((p) => p.status !== 'archived').slice(0, 5);
  }

  byId(id: string) {
    return this.items.find((p) => p.id === id) ?? null;
  }

  async load() {
    this.loading = true;
    try {
      const items = await this.root.services.projects.list();
      runInAction(() => {
        this.items = items;
        this.loaded = true;
        this.error = null;
      });
    } catch (e) {
      log.error('projects', `Couldn't load projects: ${(e as Error).message}`);
      runInAction(() => {
        this.error = (e as Error).message;
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  clear() {
    this.items = [];
    this.loaded = false;
  }

  async create(input: NewProject) {
    const p = await this.root.services.projects.create(input);
    log.info('projects', 'Project created', { id: p.id });
    runInAction(() => {
      this.items.unshift(p);
    });
    return p;
  }

  async update(id: string, patch: Parameters<RootStore['services']['projects']['update']>[1]) {
    const p = await this.root.services.projects.update(id, patch);
    runInAction(() => {
      this.items = [p, ...this.items.filter((x) => x.id !== id)];
    });
    return p;
  }

  async remove(id: string) {
    await this.root.services.projects.remove(id);
    log.info('projects', 'Project deleted', { id });
    runInAction(() => {
      this.items = this.items.filter((x) => x.id !== id);
    });
  }
}
