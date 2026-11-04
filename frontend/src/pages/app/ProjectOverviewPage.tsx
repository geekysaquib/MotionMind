import { useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { ArrowRight, Trash2 } from 'lucide-react';
import type { Project, ProjectStatus, QualityTier } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Button, Card, Field, Select } from '../../components/ui';
import { errorText } from '../../lib/format';
import { nextStage, STAGE_INFO } from '../../lib/progress';

export const ProjectOverviewPage = observer(function ProjectOverviewPage() {
  const p = useOutletContext<Project>();
  const { projects, toasts } = useStores();
  const nav = useNavigate();
  const [title, setTitle] = useState(p.title);
  const [topic, setTopic] = useState(p.topic ?? '');
  const [duration, setDuration] = useState(p.durationSec);
  const [tier, setTier] = useState<QualityTier>(p.qualityTier);
  const [status, setStatus] = useState<ProjectStatus>(p.status);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = title !== p.title || topic !== (p.topic ?? '') || duration !== p.durationSec || tier !== p.qualityTier || status !== p.status;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await projects.update(p.id, { title: title.trim(), topic: topic.trim() || null, durationSec: duration, qualityTier: tier, status });
      toasts.push('success', 'Saved.');
    } catch (err) {
      toasts.push('error', errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      await projects.remove(p.id);
      toasts.push('success', 'Project deleted.');
      nav('/app/library', { replace: true });
    } catch (err) {
      toasts.push('error', errorText(err));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <Card>
        <h2 className="font-display text-lg font-semibold">Stage 1 · Topic</h2>
        <form onSubmit={save} className="mt-5 space-y-4">
          <Field label="Project title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
          <div>
            <label htmlFor="topic" className="label">
              Topic
            </label>
            <textarea
              id="topic"
              ref={(el) => {
                // Grow with the text, so the whole topic is always visible.
                if (el) {
                  el.style.height = 'auto';
                  el.style.height = `${Math.max(280, el.scrollHeight + 2)}px`;
                }
              }}
              rows={10}
              maxLength={500}
              className="field min-h-[280px] resize-y"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <div className="mt-1 text-right text-xs text-ink-400">{topic.length}/500</div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Select label="Duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[15, 30, 45, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {d} seconds
                </option>
              ))}
            </Select>
            <Select label="Quality" value={tier} onChange={(e) => setTier(e.target.value as QualityTier)}>
              <option value="draft">Draft</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
              <option value="cinematic">Cinematic</option>
            </Select>
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)}>
              <option value="draft">Draft</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
          <Button type="submit" loading={busy} disabled={!dirty || !title.trim()}>
            Save changes
          </Button>
        </form>
      </Card>
      <div className="space-y-6">
        <Card>
          <h3 className="font-semibold">What happens next</h3>
          <ol className="mt-3 space-y-2.5 text-sm">
            {STAGE_INFO.slice(1).map((st, i) => (
              <li key={st.path}>
                <Link to={`/app/projects/${p.id}/${st.path}`} className="group flex items-start gap-3 rounded-lg p-1 transition hover:bg-line/[0.04]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint-400/15 text-[10px] font-bold text-accent">{i + 2}</span>
                  <span>
                    <span className="font-medium group-hover:text-accent">{st.label}</span>
                    <span className="block text-xs text-ink-400">{st.title}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <Link to={`/app/projects/${p.id}/${nextStage(p).path || 'research'}`} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-mint-600 px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5 hover:bg-mint-700">
            Continue: {nextStage(p).label} <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
        <Card>
          <h3 className="font-semibold text-danger">Delete project</h3>
          <p className="mt-2 text-sm text-ink-400">This removes the project permanently.</p>
          {confirmDelete ? (
            <div className="mt-4 flex gap-2">
              <Button variant="danger" onClick={() => void remove()} icon={<Trash2 className="h-4 w-4" />}>
                Yes, delete
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button className="mt-4" variant="danger" onClick={() => setConfirmDelete(true)} icon={<Trash2 className="h-4 w-4" />}>
              Delete
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
});
