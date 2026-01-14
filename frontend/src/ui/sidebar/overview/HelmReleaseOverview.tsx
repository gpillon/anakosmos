import React from 'react';
import { ArrowUpRight, Package } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { StatTile } from '../components/StatTile';
import { InfoGrid } from '../components/InfoGrid';
import { ActionButton } from '../components/ActionButton';
import { Badge } from '../components/Badge';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const HelmReleaseOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const status = raw?.status || {};
  const chart = status?.history?.[0]?.chartName || raw?.spec?.chart?.spec?.chart;
  const version = status?.history?.[0]?.chartVersion || raw?.spec?.chart?.spec?.version;
  const lastRelease = status?.lastAppliedRevision || status?.lastAttemptedRevision;

  return (
    <div className="space-y-6">
      <SidebarSection title="Release">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Status" value={status.conditions?.[0]?.status || '—'} />
          <StatTile label="Revision" value={lastRelease || '—'} />
        </div>
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'Chart', value: chart || '—' },
            { label: 'Version', value: version || '—' },
            { label: 'Namespace', value: resource.namespace || '—' },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
          ]}
        />
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-3">
          <Package size={12} />
          Helm Release overview
        </div>
      </SidebarSection>

      {onOpenDetails && (
        <SidebarSection title="Actions">
          <ActionButton icon={ArrowUpRight} label="Open Details" onClick={onOpenDetails} />
          <div className="pt-2">
            <Badge label="Helm" tone="info" />
          </div>
        </SidebarSection>
      )}
    </div>
  );
};
