import { STYLE_IDS, type Project, type StyleId } from '@motionmind/shared';

// The style is picked before the script exists. Until then the choice is kept in this browser; once the script
// is written it is saved with the script (script.style) and that copy wins.

const key = (projectId: string) => `motionmind-style:${projectId}`;

export function pickedStyle(project: Pick<Project, 'id' | 'script'>): StyleId | null {
  if (project.script?.style) return project.script.style;
  try {
    const v = localStorage.getItem(key(project.id));
    return v && (STYLE_IDS as readonly string[]).includes(v) ? (v as StyleId) : null;
  } catch {
    return null;
  }
}

export function rememberStyle(projectId: string, style: StyleId) {
  try {
    localStorage.setItem(key(projectId), style);
  } catch {
    // Private windows: the choice still reaches the script through the page state.
  }
}
