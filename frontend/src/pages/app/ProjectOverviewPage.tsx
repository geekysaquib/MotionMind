import { useState, type FormEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import type { Project, ProjectStatus, QualityTier } from '@motionmind/shared';
import { useStores } from '../../stores/RootStore';
import { Button, Card, Field, Select } from '../../components/ui';
import { errorText } from '../../lib/format';

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
            <textarea id="topic" rows={3} maxLength={500} className="field resize-none" value={topic} onChange={(e) => setTopic(e.target.value)} />
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
          <p className="mt-2 text-sm text-ink-400">
            Research is the next module. It will search trusted sources for this topic, check claims against each other and show you a report to approve before any script is written.
          </p>
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
