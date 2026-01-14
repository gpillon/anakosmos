import React from 'react';
import { ArrowUpRight, GitBranch } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { StatTile } from '../components/StatTile';
import { InfoGrid } from '../components/InfoGrid';
import { ActionButton } from '../components/ActionButton';
import { Badge } from '../components/Badge';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const ApplicationOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const status = raw?.status || {};
  const health = status.health?.status || 'Unknown';
  const sync = status.sync?.status || 'Unknown';
  const repo = status?.summary?.sourceRepos?.[0] || raw?.spec?.source?.repoURL;

  return (
    <div className="space-y-6">
      <SidebarSection title="GitOps">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Health" value={health} tone={health === 'Healthy' ? 'good' : health === 'Degraded' ? 'bad' : 'warn'} />
          <StatTile label="Sync" value={sync} tone={sync === 'Synced' ? 'good' : 'warn'} />
        </div>
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'Project', value: raw?.spec?.project || '—' },
            { label: 'Repo', value: repo || '—', mono: true },
            { label: 'Destination', value: raw?.spec?.destination?.server || raw?.spec?.destination?.name || '—', mono: true },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
          ]}
        />
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-3">
          <GitBranch size={12} />
          {repo ? 'Managed by Argo CD' : 'No repo detected'}
        </div>
      </SidebarSection>

      {onOpenDetails && (
        <SidebarSection title="Actions">
          <ActionButton icon={ArrowUpRight} label="Open Details" onClick={onOpenDetails} />
          <div className="pt-2">
            <Badge label="ArgoCD" tone="info" />
          </div>
        </SidebarSection>
      )}
    </div>
  );
};
