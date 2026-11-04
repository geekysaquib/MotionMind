import { autoCuts, DEFAULT_MUSIC_VOLUME, DEFAULT_SFX_VOLUME, MAX_AUDIO_SEC, MAX_SFX, MAX_SFX_SEC, normalizeEditor, type AudioTrack, type Project, type ReelEditor } from '@motionmind/shared';
import type { ClaudeService, EditorUrls } from '../services/claudeHttp';
import { analyzeAudio } from './audioAnalysis';
import { log } from './logger';

export class AudioFileError extends Error {}

async function uploadTrack(api: ClaudeService, projectId: string, kind: 'voice' | 'music' | 'sfx', file: File): Promise<AudioTrack> {
  let analysis;
  try {
    analysis = await analyzeAudio(file);
  } catch {
    throw new AudioFileError("This browser couldn't read that file. Try an MP3, WAV or M4A.");
  }
  if (analysis.durationSec > MAX_AUDIO_SEC) throw new AudioFileError(`That recording is ${Math.round(analysis.durationSec / 60)} minutes long. The limit is ${MAX_AUDIO_SEC / 60}.`);
  if (kind === 'sfx' && analysis.durationSec > MAX_SFX_SEC) throw new AudioFileError(`A sound effect can be at most ${MAX_SFX_SEC} seconds.`);
  if (kind !== 'sfx' && analysis.durationSec < 1) throw new AudioFileError('That recording is shorter than a second.');
  const { track } = await api.uploadAudio(projectId, kind, file, file.name);
  log.info('editor', `Uploaded ${kind}`, { projectId, seconds: Math.round(analysis.durationSec), bytes: file.size });
  return { ...track, durationSec: analysis.durationSec, peaks: analysis.peaks };
}

/** Uploads the user's voiceover, guesses where each scene starts, and saves it as the reel's voice. */
export async function attachVoice(
  api: ClaudeService,
  project: Project,
  file: File,
  current: ReelEditor | null,
): Promise<{ project: Project; editor: ReelEditor; urls: EditorUrls }> {
  const track = await uploadTrack(api, project.id, 'voice', file);
  const narrations = (project.script?.beats ?? []).map((b) => b.narration);
  const editor: ReelEditor = {
    ...normalizeEditor(current, Boolean(project.voice)),
    voiceSource: 'upload',
    upload: { track, cuts: autoCuts(track.peaks ?? [], track.durationSec, narrations) },
  };
  const saved = await api.saveEditor(project.id, editor);
  return { project: saved.project, editor: saved.project.editor ?? editor, urls: saved.urls };
}

/** Uploads background music and saves it, quiet under the voice. */
export async function attachMusic(
  api: ClaudeService,
  project: Project,
  file: File,
  current: ReelEditor,
): Promise<{ project: Project; editor: ReelEditor; urls: EditorUrls }> {
  const track = await uploadTrack(api, project.id, 'music', file);
  const editor: ReelEditor = { ...current, music: { track, volume: current.music?.volume ?? DEFAULT_MUSIC_VOLUME } };
  const saved = await api.saveEditor(project.id, editor);
  return { project: saved.project, editor: saved.project.editor ?? editor, urls: saved.urls };
}

/** Uploads a short sound effect and puts it on the reel's timeline at `at` seconds. */
export async function attachSfx(
  api: ClaudeService,
  project: Project,
  file: File,
  current: ReelEditor,
  at = 0,
): Promise<{ project: Project; editor: ReelEditor; urls: EditorUrls }> {
  if ((current.sfx ?? []).length >= MAX_SFX) throw new AudioFileError(`A reel can have at most ${MAX_SFX} sound effects.`);
  const track = await uploadTrack(api, project.id, 'sfx', file);
  const editor: ReelEditor = { ...current, sfx: [...(current.sfx ?? []), { track, at, volume: DEFAULT_SFX_VOLUME }] };
  const saved = await api.saveEditor(project.id, editor);
  return { project: saved.project, editor: saved.project.editor ?? editor, urls: saved.urls };
}
