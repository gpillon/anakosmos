import React from 'react';
import { Terminal, FileText, ArrowUpRight } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { StatTile } from '../components/StatTile';
import { InfoGrid } from '../components/InfoGrid';
import { ActionButton } from '../components/ActionButton';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const PodOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenTerminal, onOpenDetails }) => {
  const status = raw?.status || {};
  const spec = raw?.spec || {};
  const containerStatuses = status.containerStatuses || [];
  const restarts = containerStatuses.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0);
  const ready = containerStatuses.filter((c: any) => c.ready).length;
  const total = containerStatuses.length;

  return (
    <div className="space-y-6">
      <SidebarSection title="Containers">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Ready" value={`${ready}/${total || 0}`} tone={ready === total && total > 0 ? 'good' : 'warn'} />
          <StatTile label="Restarts" value={restarts} tone={restarts > 0 ? 'warn' : 'default'} />
        </div>
      </SidebarSection>

      <SidebarSection title="Quick Actions">
        <div className="grid grid-cols-2 gap-3">
          <ActionButton icon={Terminal} label="Exec Shell" onClick={() => onOpenTerminal?.('shell')} />
          <ActionButton icon={FileText} label="View Logs" onClick={() => onOpenTerminal?.('logs')} />
        </div>
        {onOpenDetails && (
          <div className="pt-2">
            <ActionButton icon={ArrowUpRight} label="Open Details" onClick={onOpenDetails} />
          </div>
        )}
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'Node', value: spec.nodeName || resource.nodeName || '—' },
            { label: 'Pod IP', value: status.podIP || '—', mono: true },
            { label: 'QoS', value: status.qosClass || '—' },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
          ]}
        />
      </SidebarSection>
    </div>
  );
};
