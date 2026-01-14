import React from 'react';
import { InfoGrid } from '../components/InfoGrid';
import { SidebarSection } from '../components/Section';
import { ActionButton } from '../components/ActionButton';
import { ArrowUpRight } from 'lucide-react';
import { formatAge } from './utils';
import type { OverviewContext } from './ResourceOverview';

export const GenericOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails }) => {
  const labelsCount = Object.keys(resource.labels || {}).length;
  const apiVersion = raw?.apiVersion;

  return (
    <div className="space-y-6">
      <SidebarSection title="Summary">
        <InfoGrid
          items={[
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
            { label: 'Labels', value: labelsCount || '—' },
            { label: 'API', value: apiVersion || '—', mono: true },
            { label: 'Kind', value: resource.kind },
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
