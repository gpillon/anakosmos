import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { InfoGrid } from '../components/InfoGrid';
import { StatTile } from '../components/StatTile';
import { ActionButton } from '../components/ActionButton';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const StorageClassOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const provisioner = raw?.provisioner;
  const reclaim = raw?.reclaimPolicy || 'Delete';
  const binding = raw?.volumeBindingMode || 'Immediate';
  const allowExpansion = raw?.allowVolumeExpansion ? 'Yes' : 'No';

  return (
    <div className="space-y-6">
      <SidebarSection title="Storage">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Reclaim" value={reclaim} />
          <StatTile label="Binding" value={binding} />
        </div>
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'Provisioner', value: provisioner || '—' },
            { label: 'Expansion', value: allowExpansion },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
            { label: 'Parameters', value: Object.keys(raw?.parameters || {}).length },
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
