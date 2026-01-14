import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { StatTile } from '../components/StatTile';
import { InfoGrid } from '../components/InfoGrid';
import { ActionButton } from '../components/ActionButton';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const JobOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const spec = raw?.spec || {};
  const status = raw?.status || {};
  const succeeded = status.succeeded ?? 0;
  const failed = status.failed ?? 0;
  const active = status.active ?? 0;

  return (
    <div className="space-y-6">
      <SidebarSection title="Execution">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Active" value={active} />
          <StatTile label="Succeeded" value={succeeded} tone={succeeded > 0 ? 'good' : 'default'} />
          <StatTile label="Failed" value={failed} tone={failed > 0 ? 'bad' : 'default'} />
          <StatTile label="Completions" value={spec.completions ?? 1} />
        </div>
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'Parallelism', value: spec.parallelism ?? 1 },
            { label: 'Backoff', value: spec.backoffLimit ?? '—' },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
            { label: 'TTL', value: spec.ttlSecondsAfterFinished ?? '—' },
          ]}
        />
      </SidebarSection>

      {onOpenDetails && (
        <SidebarSection title="Actions">
          <ActionButton icon={ArrowUpRight} label="Open Details" onClick={onOpenDetails} />
        </SidebarSection>
      )}
    </div>
  );
};
