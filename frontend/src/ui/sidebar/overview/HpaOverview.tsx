import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { StatTile } from '../components/StatTile';
import { InfoGrid } from '../components/InfoGrid';
import { ActionButton } from '../components/ActionButton';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const HpaOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const spec = raw?.spec || {};
  const status = raw?.status || {};

  return (
    <div className="space-y-6">
      <SidebarSection title="Scaling">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Min" value={spec.minReplicas ?? '—'} />
          <StatTile label="Max" value={spec.maxReplicas ?? '—'} />
          <StatTile label="Current" value={status.currentReplicas ?? 0} />
          <StatTile label="Desired" value={status.desiredReplicas ?? 0} />
        </div>
      </SidebarSection>

      <SidebarSection title="Target">
        <InfoGrid
          items={[
            { label: 'Kind', value: spec.scaleTargetRef?.kind || '—' },
            { label: 'Name', value: spec.scaleTargetRef?.name || '—' },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
            { label: 'Metrics', value: spec.metrics?.length ?? 0 },
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
