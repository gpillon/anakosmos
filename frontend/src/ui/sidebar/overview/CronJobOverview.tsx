import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { StatTile } from '../components/StatTile';
import { InfoGrid } from '../components/InfoGrid';
import { ActionButton } from '../components/ActionButton';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const CronJobOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const spec = raw?.spec || {};
  const status = raw?.status || {};

  return (
    <div className="space-y-6">
      <SidebarSection title="Schedule">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Active" value={status.active?.length ?? 0} />
          <StatTile label="Suspend" value={spec.suspend ? 'Yes' : 'No'} tone={spec.suspend ? 'warn' : 'default'} />
        </div>
      </SidebarSection>

      <SidebarSection title="Details">
        <InfoGrid
          items={[
            { label: 'Cron', value: spec.schedule || '—', mono: true },
            { label: 'Timezone', value: spec.timeZone || '—' },
            { label: 'Last Schedule', value: status.lastScheduleTime ? new Date(status.lastScheduleTime).toLocaleString() : '—' },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
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
