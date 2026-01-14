import React from 'react';
import { ArrowUpRight, Network } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { InfoGrid } from '../components/InfoGrid';
import { StatTile } from '../components/StatTile';
import { ActionButton } from '../components/ActionButton';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const NetworkAttachmentDefinitionOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const config = raw?.spec?.config || '';
  let type = 'Unknown';
  try {
    type = JSON.parse(config).type || 'Unknown';
  } catch {
    type = config ? 'Custom' : 'Unknown';
  }

  return (
    <div className="space-y-6">
      <SidebarSection title="Network">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Type" value={type} />
          <StatTile label="Config" value={config ? 'Defined' : '—'} />
        </div>
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'Namespace', value: resource.namespace || '—' },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
            { label: 'Labels', value: Object.keys(resource.labels || {}).length },
            { label: 'API', value: raw?.apiVersion || '—', mono: true },
          ]}
        />
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-3">
          <Network size={12} />
          Multus network definition
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
