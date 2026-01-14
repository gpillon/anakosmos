import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { StatTile } from '../components/StatTile';
import { InfoGrid } from '../components/InfoGrid';
import { ActionButton } from '../components/ActionButton';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const DaemonSetOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const status = raw?.status || {};
  const desired = status.desiredNumberScheduled ?? 0;
  const ready = status.numberReady ?? 0;
  const available = status.numberAvailable ?? 0;

  return (
    <div className="space-y-6">
      <SidebarSection title="Scheduling">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Desired" value={desired} />
          <StatTile label="Ready" value={ready} tone={ready === desired ? 'good' : 'warn'} />
          <StatTile label="Available" value={available} />
          <StatTile label="Misscheduled" value={status.numberMisscheduled ?? 0} tone={status.numberMisscheduled ? 'warn' : 'default'} />
        </div>
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'Update', value: raw?.spec?.updateStrategy?.type || 'RollingUpdate' },
            { label: 'Max Unavail', value: raw?.spec?.updateStrategy?.rollingUpdate?.maxUnavailable || '—' },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
            { label: 'Selector', value: raw?.spec?.selector?.matchLabels ? 'Labels' : '—' },
          ]}
        />
      </SidebarSection>

      {onOpenDetails && (
        <SidebarSection title="Actions">
          <ActionButton icon={ArrowUpRight} label="Open Details" onClick={onOpenDetails} />
        </SidebarSection>
      )}
    </div>
  );
};
