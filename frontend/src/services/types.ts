import type { Profile, Project, ProviderId, StoredKeySummary, KeyTestResult, QualityTier } from '@motionmind/shared';
import type { ClaudeService } from './claudeHttp';

export interface Session {
  userId: string;
  email: string;
  accessToken: string;
}

export class ServiceError extends Error {
  constructor(message: string, readonly code: string = 'error') {
    super(message);
  }
}

/** Email one-time-code sign-in. A first sign-in creates the account. */
export interface AuthService {
  getSession(): Promise<Session | null>;
  onChange(cb: (session: Session | null, event: string) => void): () => void;
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
}

export type ProfilePatch = Partial<Omit<Profile, 'id'>>;

export interface ProfileService {
  get(userId: string): Promise<Profile>;
  update(userId: string, patch: ProfilePatch): Promise<Profile>;
  isHandleAvailable(handle: string): Promise<boolean>;
}

export interface NewProject {
  title: string;
  topic: string | null;
  durationSec: number;
  qualityTier: QualityTier;
}

export interface ProjectService {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  create(input: NewProject): Promise<Project>;
  update(id: string, patch: Partial<NewProject & Pick<Project, 'status' | 'stage'>>): Promise<Project>;
  remove(id: string): Promise<void>;
}

export interface KeysService {
  list(): Promise<StoredKeySummary[]>;
  save(provider: ProviderId, apiKey: string): Promise<StoredKeySummary>;
  remove(provider: ProviderId): Promise<void>;
  test(provider: ProviderId): Promise<{ result: KeyTestResult; tested: boolean }>;
}

export interface Services {
  mode: 'api' | 'memory';
  auth: AuthService;
  profiles: ProfileService;
  projects: ProjectService;
  /** Built lazily because it needs the current access token. */
  keys: (getToken: () => string | null) => KeysService;
  /** Same: Claude calls are signed in. */
  claude: (getToken: () => string | null) => ClaudeService;
}
