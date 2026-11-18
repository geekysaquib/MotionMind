import { autoCuts, DEFAULT_MUSIC_VOLUME, MAX_AUDIO_SEC, normalizeEditor, type AudioTrack, type Project, type ReelEditor } from '@motionmind/shared';
import type { ClaudeService, EditorUrls } from '../services/claudeHttp';
import { analyzeAudio } from './audioAnalysis';
import { log } from './logger';

export class AudioFileError extends Error {}

type Saved = { project: Project; editor: ReelEditor; urls: EditorUrls };

async function uploadTrack(api: ClaudeService, projectId: string, kind: 'voice' | 'music', file: File): Promise<AudioTrack> {
  let analysis;
  try {
    analysis = await analyzeAudio(file);
  } catch {
    throw new AudioFileError("This browser couldn't read that file. Try an MP3, WAV or M4A.");
  }
  if (analysis.durationSec > MAX_AUDIO_SEC) throw new AudioFileError(`That recording is ${Math.round(analysis.durationSec / 60)} minutes long. The limit is ${MAX_AUDIO_SEC / 60}.`);
  if (analysis.durationSec < 1) throw new AudioFileError('That recording is shorter than a second.');
  const { track } = await api.uploadAudio(projectId, kind, file, file.name);
  log.info('editor', `Uploaded ${kind}`, { projectId, seconds: Math.round(analysis.durationSec), bytes: file.size });
  return { ...track, durationSec: analysis.durationSec, peaks: analysis.peaks };
}

/**
 * Uploads the user's voiceover and saves it with a first guess of the scene breaks, then asks the API to fit the
 * script to it: where each scene starts and when every word is spoken.
 */
export async function attachVoice(api: ClaudeService, project: Project, file: File, current: ReelEditor | null): Promise<Saved & { fit: 'speech' | 'loudness' | null; note: string | null }> {
  const track = await uploadTrack(api, project.id, 'voice', file);
  const narrations = (project.script?.beats ?? []).map((b) => b.narration);
  const editor: ReelEditor = { ...normalizeEditor(current), upload: { track, cuts: autoCuts(track.peaks ?? [], track.durationSec, narrations) } };
  const saved = await api.saveEditor(project.id, editor);
  try {
    const fitted = await api.fitVoice(project.id);
    return { project: fitted.project, editor: fitted.project.editor ?? editor, urls: fitted.urls, fit: fitted.fit, note: fitted.note };
  } catch (err) {
    // The recording is saved; the fit can be run again from the page.
    log.warn('editor', 'Auto-fit failed after upload', { projectId: project.id, err: String(err) });
    return { project: saved.project, editor: saved.project.editor ?? editor, urls: saved.urls, fit: null, note: err instanceof Error ? err.message : null };
  }
}

/** Uploads background music and saves it, quiet under the voice. */
export async function attachMusic(api: ClaudeService, project: Project, file: File, current: ReelEditor): Promise<Saved> {
  const track = await uploadTrack(api, project.id, 'music', file);
  const editor: ReelEditor = { ...current, music: { track, volume: current.music?.volume ?? DEFAULT_MUSIC_VOLUME } };
  const saved = await api.saveEditor(project.id, editor);
  return { project: saved.project, editor: saved.project.editor ?? editor, urls: saved.urls };
}
