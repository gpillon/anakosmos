import React, { useMemo } from 'react';
import { ArrowUpRight, Network } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { InfoGrid } from '../components/InfoGrid';
import { StatTile } from '../components/StatTile';
import { ActionButton } from '../components/ActionButton';
import { useClusterStore } from '../../../store/useClusterStore';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const ServiceOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const resources = useClusterStore(state => state.resources);
  const spec = raw?.spec || {};
  const status = raw?.status || {};
  const selector = spec.selector || {};
  const ports = spec.ports || [];

  const matchingPods = useMemo(() => {
    if (!selector || Object.keys(selector).length === 0) return 0;
    return Object.values(resources).filter(r => {
      if (r.kind !== 'Pod' || r.namespace !== resource.namespace) return false;
      const labels = r.raw?.metadata?.labels || {};
      return Object.entries(selector).every(([k, v]) => labels[k] === v);
    }).length;
  }, [resources, selector, resource.namespace]);

  const externalIP = status?.loadBalancer?.ingress?.[0]?.ip || status?.loadBalancer?.ingress?.[0]?.hostname;

  return (
    <div className="space-y-6">
      <SidebarSection title="Traffic">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Ports" value={ports.length || 0} />
          <StatTile label="Matching Pods" value={matchingPods} />
        </div>
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'Type', value: spec.type || 'ClusterIP' },
            { label: 'Cluster IP', value: spec.clusterIP || '—', mono: true },
            { label: 'External IP', value: externalIP || '—', mono: true },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
          ]}
        />
      </SidebarSection>

      <SidebarSection title="Endpoints" subtitle={ports.map((p: any) => `${p.port}/${p.protocol || 'TCP'}`).join(', ') || '—'}>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Network size={12} />
          {Object.keys(selector || {}).length > 0 ? 'Selectors active' : 'No selector defined'}
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
