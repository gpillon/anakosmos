import React from 'react';
import { ArrowUpRight, FileText } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { StatTile } from '../components/StatTile';
import { InfoGrid } from '../components/InfoGrid';
import { ActionButton } from '../components/ActionButton';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const ConfigMapOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const dataKeys = Object.keys(raw?.data || {}).length;
  const binaryKeys = Object.keys(raw?.binaryData || {}).length;

  return (
    <div className="space-y-6">
      <SidebarSection title="Data">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Keys" value={dataKeys} />
          <StatTile label="Binary" value={binaryKeys} />
        </div>
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'Immutable', value: raw?.immutable ? 'Yes' : 'No' },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
            { label: 'Labels', value: Object.keys(resource.labels || {}).length },
            { label: 'API', value: raw?.apiVersion || '—', mono: true },
          ]}
        />
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-3">
          <FileText size={12} />
          {dataKeys > 0 ? 'Config data available' : 'No data entries'}
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
