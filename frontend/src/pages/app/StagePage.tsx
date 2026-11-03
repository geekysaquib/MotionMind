import { ComingNext } from './ComingNext';

const STAGES: Record<string, { title: string; phase: string; points: string[]; needs?: { label: string; to: string } }> = {
  research: {
    title: 'Research workspace',
    phase: 'Phase 1',
    points: ['Searches multiple trusted sources and stores every URL.', 'Each claim is marked verified, single-source, estimate or conflicting.', 'You approve the report before the script is written.'],
    needs: { label: 'Needs a Tavily or Exa key', to: '/app/settings/keys' },
  },
  script: {
    title: 'Script generator',
    phase: 'Phase 1',
    points: ['Hook, intro, body, twist, conclusion and call to action.', 'Styles: educational, documentary, mystery, news explainer and more.', 'Hindi, Hinglish or English, with every fact linked to its source.'],
    needs: { label: 'Needs an OpenAI or Anthropic key', to: '/app/settings/keys' },
  },
  storyboard: { title: 'Storyboard editor', phase: 'Phase 2', points: ['Scene-by-scene narration, on-screen text, camera moves and transitions.', 'Warns when two scenes look too similar.'] },
  graphics: { title: 'Graphics studio', phase: 'Phase 2', points: ['World mode: the isometric 3D style from your test reel.', 'Illustration mode: AI images with a consistent style profile.'] },
  voice: { title: 'Voice studio', phase: 'Phase 2', points: ['ElevenLabs or Google voices, per-scene regeneration.', 'Word-level timings for perfectly synced captions.'], needs: { label: 'Needs an ElevenLabs key', to: '/app/settings/keys' } },
  editor: { title: 'Reel editor', phase: 'Phase 3', points: ['9:16 preview, scene timeline, caption styles, music and SFX tracks.', 'Only changed scenes re-render.'] },
  export: { title: 'Export center', phase: 'Phase 3', points: ['1080 × 1920 H.264 MP4 at 30 fps.', 'Cover image, caption text with hashtags, and a sources list.'] },
};

export function StagePage({ stage }: { stage: keyof typeof STAGES }) {
  const s = STAGES[stage]!;
  return <ComingNext {...s} />;
}
