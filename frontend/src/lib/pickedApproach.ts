import { APPROACH_IDS, DEFAULT_APPROACH, type ApproachId } from '@motionmind/shared';

// How the reel explains its topic, kept in this browser per project so Research and Script use the same choice.

const key = (projectId: string) => `motionmind-approach:${projectId}`;

export function pickedApproach(projectId: string): ApproachId {
  try {
    const v = localStorage.getItem(key(projectId));
    return v && (APPROACH_IDS as readonly string[]).includes(v) ? (v as ApproachId) : DEFAULT_APPROACH;
  } catch {
    return DEFAULT_APPROACH;
  }
}

export function rememberApproach(projectId: string, approach: ApproachId) {
  try {
    localStorage.setItem(key(projectId), approach);
  } catch {
    // Private windows: the choice still applies on this page.
  }
}
