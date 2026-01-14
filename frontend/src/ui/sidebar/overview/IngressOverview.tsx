import React from 'react';
import { Globe, ArrowUpRight } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { InfoGrid } from '../components/InfoGrid';
import { StatTile } from '../components/StatTile';
import { ActionButton } from '../components/ActionButton';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const IngressOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const spec = raw?.spec || {};
  const status = raw?.status || {};
  const rules = spec.rules || [];
  const hosts = rules.map((r: any) => r.host).filter(Boolean);
  const tls = spec.tls || [];
  const address = status?.loadBalancer?.ingress?.[0]?.ip || status?.loadBalancer?.ingress?.[0]?.hostname;

  return (
    <div className="space-y-6">
      <SidebarSection title="Routing">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Hosts" value={hosts.length || 0} />
          <StatTile label="TLS" value={tls.length || 0} tone={tls.length > 0 ? 'good' : 'default'} />
        </div>
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'Address', value: address || '—', mono: true },
            { label: 'Rules', value: rules.length || 0 },
            { label: 'Ingress Class', value: spec.ingressClassName || '—' },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
          ]}
        />
      </SidebarSection>

      {hosts.length > 0 && (
        <SidebarSection title="Hosts">
          <div className="flex flex-wrap gap-2">
            {hosts.slice(0, 4).map((host: string) => (
              <span key={host} className="inline-flex items-center gap-1 text-xs bg-slate-800 px-2 py-1 rounded">
                <Globe size={12} className="text-blue-400" />
                {host}
              </span>
            ))}
            {hosts.length > 4 && (
              <span className="text-xs text-slate-500">+{hosts.length - 4} more</span>
            )}
          </div>
        </SidebarSection>
      )}

      {onOpenDetails && (
        <SidebarSection title="Actions">
          <ActionButton icon={ArrowUpRight} label="Open Details" onClick={onOpenDetails} />
        </SidebarSection>
      )}
    </div>
  );
};
