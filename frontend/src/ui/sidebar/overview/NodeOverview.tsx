import React from 'react';
import { Cpu, HardDrive, ArrowUpRight } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { StatTile } from '../components/StatTile';
import { InfoGrid } from '../components/InfoGrid';
import { ActionButton } from '../components/ActionButton';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const NodeOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const status = raw?.status || {};
  const capacity = status.capacity || {};
  const allocatable = status.allocatable || {};
  const nodeInfo = status.nodeInfo || {};

  return (
    <div className="space-y-6">
      <SidebarSection title="Capacity">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="CPU" value={capacity.cpu || '—'} />
          <StatTile label="Memory" value={capacity.memory || '—'} />
          <StatTile label="Alloc CPU" value={allocatable.cpu || '—'} />
          <StatTile label="Alloc Mem" value={allocatable.memory || '—'} />
        </div>
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'Kubelet', value: nodeInfo.kubeletVersion || '—' },
            { label: 'OS', value: nodeInfo.osImage || '—' },
            { label: 'Arch', value: nodeInfo.architecture || '—' },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
          ]}
        />
        <div className="flex items-center gap-3 text-xs text-slate-400 mt-3">
          <Cpu size={12} />
          <HardDrive size={12} />
          Resources reflect node capacity
        </div>
      </SidebarSection>

      {onOpenDetails && (
        <SidebarSection title="Actions">
          <ActionButton icon={ArrowUpRight} label="Open Details" onClick={onOpenDetails} />
        </SidebarSection>
      )}
    </div>
  );
};
