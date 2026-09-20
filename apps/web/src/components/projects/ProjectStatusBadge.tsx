import { PROJECT_STATUS_LABELS, type ProjectStatus } from '@fbm/shared';
import { Badge } from '../ui/Badge';

const toneByStatus: Record<
  ProjectStatus,
  'neutral' | 'success' | 'warning' | 'danger' | 'brand' | 'info'
> = {
  PLANNING: 'info',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  COMPLETED: 'brand',
  CANCELLED: 'neutral',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge tone={toneByStatus[status]}>
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}
