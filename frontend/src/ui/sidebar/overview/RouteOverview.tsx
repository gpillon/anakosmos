import React from 'react';
import { ArrowUpRight, Globe } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { InfoGrid } from '../components/InfoGrid';
import { ActionButton } from '../components/ActionButton';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const RouteOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const spec = raw?.spec || {};
  const status = raw?.status || {};
  const host = spec.host;
  const to = spec.to?.name;
  const wildcard = spec.wildcardPolicy;
  const admitted = status.ingress?.[0]?.conditions?.find((c: any) => c.type === 'Admitted')?.status;

  return (
    <div className="space-y-6">
      <SidebarSection title="Route">
        <InfoGrid
          items={[
            { label: 'Host', value: host || '—', mono: true },
            { label: 'Service', value: to || '—' },
            { label: 'Admitted', value: admitted || 'Unknown' },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
          ]}
        />
        {host && (
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-3">
            <Globe size={12} className="text-pink-400" />
            {wildcard ? `Wildcard: ${wildcard}` : 'No wildcard'}
          </div>
        )}
      </SidebarSection>

      {onOpenDetails && (
        <SidebarSection title="Actions">
          <ActionButton icon={ArrowUpRight} label="Open Details" onClick={onOpenDetails} />
        </SidebarSection>
      )}
    </div>
  );
};
