import type { Project } from '@motionmind/shared';
import { Badge } from '../../components/ui';

export function StatusBadge({ status }: { status: Project['status'] }) {
  const map = { draft: ['neutral', 'Draft'], in_progress: ['violet', 'In progress'], completed: ['mint', 'Completed'], archived: ['amber', 'Archived'] } as const;
  const [tone, label] = map[status];
  return <Badge tone={tone}>{label}</Badge>;
}
