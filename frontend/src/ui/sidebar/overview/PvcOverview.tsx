import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { StatTile } from '../components/StatTile';
import { InfoGrid } from '../components/InfoGrid';
import { ActionButton } from '../components/ActionButton';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const PvcOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const status = raw?.status || {};
  const spec = raw?.spec || {};
  const capacity = status.capacity?.storage;
  const accessModes = (status.accessModes || spec.accessModes || []).join(', ') || '—';

  return (
    <div className="space-y-6">
      <SidebarSection title="Storage">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Phase" value={status.phase || '—'} tone={status.phase === 'Bound' ? 'good' : 'warn'} />
          <StatTile label="Capacity" value={capacity || '—'} />
        </div>
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'StorageClass', value: spec.storageClassName || '—' },
            { label: 'Access Modes', value: accessModes },
            { label: 'Volume', value: spec.volumeName || '—', mono: true },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
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
