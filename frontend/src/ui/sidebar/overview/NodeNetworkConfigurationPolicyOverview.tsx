import React from 'react';
import { ArrowUpRight, Settings } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { InfoGrid } from '../components/InfoGrid';
import { StatTile } from '../components/StatTile';
import { ActionButton } from '../components/ActionButton';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const NodeNetworkConfigurationPolicyOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const status = raw?.status || {};
  const conditions = status.conditions || [];
  const last = conditions[0];

  return (
    <div className="space-y-6">
      <SidebarSection title="Status">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Conditions" value={conditions.length} />
          <StatTile label="State" value={last?.type || '—'} tone={last?.status === 'True' ? 'good' : 'warn'} />
        </div>
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'Reason', value: last?.reason || '—' },
            { label: 'Message', value: last?.message || '—' },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
            { label: 'API', value: raw?.apiVersion || '—', mono: true },
          ]}
        />
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-3">
          <Settings size={12} />
          Node network policy
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
