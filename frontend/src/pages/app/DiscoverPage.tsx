import { PageHeader } from '../../layout/AppShell';
import { ComingNext } from './ComingNext';

export function DiscoverPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6 md:p-10">
      <PageHeader title="Discover topics" subtitle="Find topics that work as short explainers." />
      <ComingNext
        title="AI topic discovery"
        phase="Phase 1, next step"
        points={[
          'Search any topic, or browse trending and evergreen ideas by category.',
          'Each card shows why it is interesting, the audience, suggested duration and an opening hook.',
          'Popularity comes from real signals (news recency, Wikipedia page views) with the source shown.',
          'Ideas you have already seen are not repeated.',
        ]}
        needs={{ label: 'Add a Tavily or Exa key in Settings', to: '/app/settings/keys' }}
      />
    </div>
  );
}
