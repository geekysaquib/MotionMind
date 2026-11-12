import { observer } from 'mobx-react-lite';
import { ClipboardCopy, Hash } from 'lucide-react';
import type { Project } from '@motionmind/shared';
import { useStores } from '../stores/RootStore';
import { Button, Card } from './ui';
import { timeAgo } from '../lib/format';
import { log } from '../lib/logger';
import { ClaudeAiPanel } from '../pages/app/PasteScriptPanel';

/** Captions and hashtags for posting the reel: a prompt for claude.ai, then the pasted answer with copy buttons. */
export const PostKit = observer(function PostKit({ project }: { project: Project }) {
  const { services, auth, projects, toasts } = useStores();
  const api = services.claude(() => auth.session?.accessToken ?? null);
  const post = project.script?.post;
  if (!project.script) return null;
  const tags = post?.hashtags.join(' ') ?? '';

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toasts.push('success', `${what} copied.`);
    } catch {
      toasts.push('error', "Couldn't copy. Select the text and copy it by hand.");
    }
  }

  return (
    <div className="space-y-4">
      <ClaudeAiPanel
        title={post ? 'Ask Claude for new captions and hashtags' : 'Caption and hashtags in claude.ai'}
        chatHint="Turn on web search in claude.ai first, so Claude can look up the hashtags people are using now."
        placeholder='{ "captions": ["..."], "hashtags": ["#..."], "title": "..." }'
        logScope="Post"
        getPrompt={(note) => api.postPrompt(project.id, note)}
        onImport={async (text) => {
          const p = await api.importPost(project.id, text);
          projects.upsert(p);
          log.info('post', 'Captions and hashtags imported', { projectId: project.id, hashtags: p.script?.post?.hashtags.length });
        }}
      />
      {post && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Hash className="h-4 w-4 text-accent" /> Your post
            </h3>
            <span className="text-xs text-ink-400">Made {timeAgo(post.createdAt)}</span>
          </div>
          {post.title && (
            <div className="mt-4 rounded-xl border border-line/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">YouTube Shorts title · {post.title.length} characters</span>
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
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Caption {i + 1}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" aria-label={`Copy caption ${i + 1}`} onClick={() => void copy(c, `Caption ${i + 1}`)}>
                      Copy
                    </Button>
                    <Button variant="secondary" size="sm" icon={<ClipboardCopy className="h-3.5 w-3.5" />} aria-label={`Copy caption ${i + 1} with hashtags`} onClick={() => void copy(`${c}\n\n${tags}`, 'Caption and hashtags')}>
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
              <Button variant="ghost" aria-label="Copy the hashtags" onClick={() => void copy(tags, 'Hashtags')}>
                Copy
              </Button>
            </div>
            <p className="mt-2 flex flex-wrap gap-1.5">
              {post.hashtags.map((h) => (
                <span key={h} className="rounded-full bg-line/[0.07] px-2.5 py-1 text-xs text-ink-300">
                  {h}
                </span>
              ))}
            </p>
          </div>
          <p className="mt-3 text-xs text-ink-400">The hashtags are Claude's picks from what it found or knows. Motion Mind does not measure how popular they are, so skim them before you post.</p>
        </Card>
      )}
    </div>
  );
});
