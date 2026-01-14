import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { StatTile } from '../components/StatTile';
import { InfoGrid } from '../components/InfoGrid';
import { ActionButton } from '../components/ActionButton';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const ReplicaSetOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const spec = raw?.spec || {};
  const status = raw?.status || {};
  const desired = spec.replicas ?? 0;
  const ready = status.readyReplicas ?? 0;
  const available = status.availableReplicas ?? 0;

  return (
    <div className="space-y-6">
      <SidebarSection title="Replicas">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Desired" value={desired} />
          <StatTile label="Ready" value={ready} tone={ready === desired ? 'good' : 'warn'} />
          <StatTile label="Available" value={available} />
          <StatTile label="Fully Labeled" value={status.fullyLabeledReplicas ?? 0} />
        </div>
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'Selector', value: spec.selector?.matchLabels ? 'Labels' : '—' },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
            { label: 'Revision', value: raw?.metadata?.annotations?.['deployment.kubernetes.io/revision'] || '—' },
            { label: 'Min Ready', value: spec.minReadySeconds ?? 0 },
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
