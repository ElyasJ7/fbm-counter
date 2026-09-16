import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

type PlaceholderPageProps = {
  title: string;
  description: string;
  phase: string;
};

export function PlaceholderPage({
  title,
  description,
  phase,
}: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <EmptyState
        title={`${title} comes in ${phase}`}
        description="Navigation and access control are in place. Domain features will be implemented in later phases."
      />
    </div>
  );
}
