// Generates narration per beat with ElevenLabs (with-timestamps) and writes src/voice.json.
// Needs ELEVENLABS_API_KEY in the environment. Optional: ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error('ELEVENLABS_API_KEY is not set. Add it to the cloud environment, then start a new session.');
const MODEL = process.env.ELEVENLABS_MODEL ?? 'eleven_multilingual_v2';
const API = 'https://api.elevenlabs.io/v1';
const FPS = 30;

async function call(path, init = {}) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', ...init.headers } });
  if (!res.ok) throw new Error(`ElevenLabs ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

let voiceId = process.env.ELEVENLABS_VOICE_ID;
if (!voiceId) {
  const { voices } = await call('/voices');
  console.log('Available voices:');
  for (const v of voices) console.log(`  ${v.voice_id}  ${v.name}  ${JSON.stringify(v.labels ?? {})}`);
  voiceId = voices[0]?.voice_id;
  console.log(`No ELEVENLABS_VOICE_ID set, using ${voiceId}`);
}

const src = await fs.readFile('src/hindi.ts', 'utf8');
const lines = [...src.matchAll(/^\s*'(.+)',$/gm)].map((m) => m[1]);
await fs.mkdir('public/voice', { recursive: true });

const beats = [];
for (const [i, text] of lines.entries()) {
  const file = `public/voice/beat_${i}.mp3`;
  const cache = `public/voice/beat_${i}.json`;
  let data;
  try {
    data = JSON.parse(await fs.readFile(cache, 'utf8'));
    if (data.text !== text || data.voiceId !== voiceId) throw new Error('stale');
  } catch {
    const out = await call(`/text-to-speech/${voiceId}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST',
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3, speed: 1.05 } }),
    });
    await fs.writeFile(file, Buffer.from(out.audio_base64, 'base64'));
    data = { text, voiceId, alignment: out.alignment };
    await fs.writeFile(cache, JSON.stringify(data));
    console.log(`beat ${i}: generated`);
  }
  const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());
  // word start/end from character alignment
  const a = data.alignment;
  const words = [];
  let cur = null;
  a.characters.forEach((ch, k) => {
    if (/\s/.test(ch)) { if (cur) words.push(cur); cur = null; return; }
    if (!cur) cur = { start: a.character_start_times_seconds[k], end: a.character_end_times_seconds[k] };
    else cur.end = a.character_end_times_seconds[k];
  });
  if (cur) words.push(cur);
  beats.push({ durationSec: dur, words });
}
await fs.writeFile('src/voice.json', JSON.stringify({ fps: FPS, voiceId, model: MODEL, beats }, null, 1));
console.log('wrote src/voice.json');
