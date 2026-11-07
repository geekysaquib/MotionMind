import { makeAutoObservable, runInAction } from 'mobx';
import type { Project, ReelScript, StyleId } from '@motionmind/shared';
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

  /** Claude writes the reel script for this project (server side, with the user's Anthropic key). */
  async writeScript(id: string, style?: StyleId | null) {
    log.info('claude', 'Writing reel script', { projectId: id });
    const started = Date.now();
    const p = await this.root.services.claude(() => this.root.auth.session?.accessToken ?? null).writeScript(id, style);
    log.info('claude', 'Reel script written', { projectId: id, beats: p.script?.beats.length, model: p.script?.model, ms: Date.now() - started });
    runInAction(() => {
      this.items = [p, ...this.items.filter((x) => x.id !== id)];
    });
    return p;
  }

  private get claude() {
    return this.root.services.claude(() => this.root.auth.session?.accessToken ?? null);
  }

  /** Puts a project returned by the API first in the list, replacing the old copy. */
  upsert(p: Project) {
    return this.replace(p);
  }

  private replace(p: Project) {
    runInAction(() => {
      this.items = [p, ...this.items.filter((x) => x.id !== p.id)];
    });
    return p;
  }

  /** Claude researches the topic on the web (server key). Saved unapproved until the user approves it. */
  async research(id: string) {
    log.info('claude', 'Researching topic', { projectId: id });
    const started = Date.now();
    const p = await this.claude.research(id);
    log.info('claude', 'Research done', { projectId: id, facts: p.research?.facts.length, sources: p.research?.sources.length, ms: Date.now() - started });
    return this.replace(p);
  }

  async importResearch(id: string, text: string) {
    const p = await this.claude.importResearch(id, text);
    log.info('claude', 'Pasted research imported', { projectId: id, facts: p.research?.facts.length });
    return this.replace(p);
  }

  async saveScript(id: string, script: ReelScript) {
    const p = await this.claude.saveScript(id, script);
    log.info('storyboard', 'Storyboard saved', { projectId: id, beats: script.beats.length });
    return this.replace(p);
  }

  async approveResearch(id: string) {
    const p = await this.claude.approveResearch(id);
    log.info('claude', 'Research approved', { projectId: id });
    return this.replace(p);
  }

  /** Saves a script written in claude.ai and pasted back (for people without an API key). */
  async importScript(id: string, text: string, style?: StyleId | null) {
    const p = await this.root.services.claude(() => this.root.auth.session?.accessToken ?? null).importScript(id, text, style);
    log.info('claude', 'Pasted script imported', { projectId: id, beats: p.script?.beats.length });
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
