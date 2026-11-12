import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ClipboardCopy, Hash } from 'lucide-react';
import { normalizePlatforms, PLATFORMS, type Platform, type Project } from '@motionmind/shared';
import { useStores } from '../stores/RootStore';
import { Button, Card } from './ui';
import { PlatformIcon } from './BrandIcons';
import { timeAgo } from '../lib/format';
import { log } from '../lib/logger';
import { cn } from '../lib/cn';
import { ClaudeAiPanel } from '../pages/app/PasteScriptPanel';

/**
 * The post for each platform the reel goes to: Instagram gets captions and hashtags, YouTube Shorts a title, descriptions
 * and its own few hashtags. A prompt for claude.ai, then the pasted answer with copy buttons.
 */
export const PostKit = observer(function PostKit({ project }: { project: Project }) {
  const { services, auth, projects, toasts } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const platforms = normalizePlatforms(project.platforms);
  const [platform, setPlatform] = useState<Platform>(platforms[0]!);
  if (!project.script) return null;
  const active = platforms.includes(platform) ? platform : platforms[0]!;
  const yt = active === 'youtube';
  const post = project.script.post?.[active];
  const tags = post?.hashtags.join(' ') ?? '';
  const what = yt ? 'Description' : 'Caption';

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toasts.push('success', `${label} copied.`);
    } catch {
      toasts.push('error', "Couldn't copy. Select the text and copy it by hand.");
    }
  }

  return (
    <div className="space-y-4">
      {platforms.length > 1 && (
        <div className="inline-flex gap-1 rounded-xl bg-line/[0.06] p-1" role="tablist" aria-label="Platform for the post">
          {platforms.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={p === active}
              onClick={() => setPlatform(p)}
              className={cn('inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition', p === active ? 'bg-ink-900 text-ink-100 shadow-sm' : 'text-ink-400 hover:text-ink-100')}
            >
              <PlatformIcon platform={p} className="h-4 w-4" /> {PLATFORMS[p].label}
            </button>
          ))}
        </div>
      )}
      <ClaudeAiPanel
        key={active}
        title={`${post ? 'New' : ''} ${yt ? 'title, description and hashtags' : 'caption and hashtags'} for ${PLATFORMS[active].label}`.trim().replace(/^./, (c) => c.toUpperCase())}
        chatHint="Turn on web search in claude.ai first, so Claude can look up the hashtags people are using now."
        placeholder='{ "title": "...", "captions": ["..."], "hashtags": ["#..."] }'
        logScope="Post"
        getPrompt={(note) => api.postPrompt(project.id, active, note)}
        onImport={async (text) => {
          const p = await api.importPost(project.id, active, text);
          projects.upsert(p);
          log.info('post', 'Post imported', { projectId: project.id, platform: active, hashtags: p.script?.post?.[active]?.hashtags.length });
        }}
      />
      {post && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Hash className="h-4 w-4 text-accent" /> Your {PLATFORMS[active].label} post
            </h3>
            <span className="text-xs text-ink-400">Made {timeAgo(post.createdAt)}</span>
          </div>
          {post.title && (
            <div className="mt-4 rounded-xl border border-line/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Title · {post.title.length} characters</span>
                <Button variant="ghost" aria-label="Copy the title" onClick={() => void copy(post.title!, 'Title')}>
                  Copy
                </Button>
              </div>
              <p className="mt-1 text-sm font-medium">{post.title}</p>
            </div>
          )}
          <ol className="mt-3 space-y-3">
            {post.captions.map((c, i) => (
              <li key={i} className="rounded-xl border border-line/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                    {what} {i + 1}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" aria-label={`Copy ${what.toLowerCase()} ${i + 1}`} onClick={() => void copy(c, `${what} ${i + 1}`)}>
                      Copy
                    </Button>
                    <Button variant="secondary" size="sm" icon={<ClipboardCopy className="h-3.5 w-3.5" />} aria-label={`Copy ${what.toLowerCase()} ${i + 1} with hashtags`} onClick={() => void copy(`${c}\n\n${tags}`, `${what} and hashtags`)}>
                      With hashtags
                    </Button>
                  </div>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{c}</p>
              </li>
            ))}
          </ol>
          <div className="mt-3 rounded-xl border border-line/10 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{post.hashtags.length} hashtags</span>
              <div className="flex gap-1">
                {!yt && post.hashtags.length > 5 && (
                  <Button variant="ghost" aria-label="Copy the first five hashtags" onClick={() => void copy(post.hashtags.slice(0, 5).join(' '), 'First five hashtags')}>
                    Copy first 5
                  </Button>
                )}
                <Button variant="ghost" aria-label="Copy the hashtags" onClick={() => void copy(tags, 'Hashtags')}>
                  Copy all
                </Button>
              </div>
            </div>
            <p className="mt-2 flex flex-wrap gap-1.5">
              {post.hashtags.map((h, i) => (
                <span key={h} className={cn('rounded-full px-2.5 py-1 text-xs', !yt && i < 5 ? 'bg-mint-500/20 text-ink-100' : 'bg-line/[0.07] text-ink-300')}>
                  {h}
                </span>
              ))}
            </p>
          </div>
          <p className="mt-3 text-xs text-ink-400">
            {yt
              ? 'YouTube shows the first three hashtags above the title, so a few are enough; #Shorts is always first.'
              : 'Instagram advises 3 to 5 focused hashtags: the first five (highlighted) are the strongest and work on their own.'}{' '}
            These are Claude's picks from what it found or knows. Motion Mind does not measure how popular they are, so skim them before you post.
          </p>
        </Card>
      )}
    </div>
  );
});
