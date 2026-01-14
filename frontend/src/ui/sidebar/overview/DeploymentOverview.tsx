import React, { useMemo } from 'react';
import { Activity, Minus, Plus, Scale, ArrowUpRight } from 'lucide-react';
import { SidebarSection } from '../components/Section';
import { StatTile } from '../components/StatTile';
import { InfoGrid } from '../components/InfoGrid';
import { ActionButton } from '../components/ActionButton';
import { Badge } from '../components/Badge';
import type { OverviewContext } from './ResourceOverview';
import { formatAge } from './utils';

export const DeploymentOverview: React.FC<OverviewContext> = ({ resource, raw, onOpenDetails, onScale, scaleInProgress }) => {
  const spec = raw?.spec || {};
  const status = raw?.status || {};
  const desired = spec.replicas ?? status.replicas ?? 0;
  const available = status.availableReplicas ?? 0;
  const updated = status.updatedReplicas ?? 0;
  const unavailable = status.unavailableReplicas ?? Math.max(desired - available, 0);
  const strategy = spec.strategy?.type || 'RollingUpdate';
  const revision = raw?.metadata?.annotations?.['deployment.kubernetes.io/revision'];
  const images = (spec.template?.spec?.containers || []).map((c: any) => c.image).filter(Boolean);

  const healthTone = useMemo(() => {
    if (desired === 0) return 'good';
    if (available === desired) return 'good';
    if (available > 0) return 'warn';
    return 'bad';
  }, [desired, available]);

  return (
    <div className="space-y-6">
      <SidebarSection title="Replicas">
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Desired" value={desired} tone={healthTone} />
          <StatTile label="Available" value={available} tone={healthTone} />
          <StatTile label="Updated" value={updated} />
          <StatTile label="Unavailable" value={unavailable} tone={unavailable > 0 ? 'warn' : 'default'} />
        </div>
      </SidebarSection>

      <SidebarSection title="Quick Actions">
        <div className="grid grid-cols-2 gap-3">
          <ActionButton
            icon={Scale}
            label="Scale to 0"
            disabled={!onScale || scaleInProgress || desired === 0}
            onClick={() => onScale?.(0)}
          />
          <ActionButton
            icon={Activity}
            label="Scale to 1"
            disabled={!onScale || scaleInProgress || desired === 1}
            onClick={() => onScale?.(1)}
          />
          <ActionButton
            icon={Minus}
            label="Minus 1"
            disabled={!onScale || scaleInProgress || desired <= 0}
            onClick={() => onScale?.(Math.max(desired - 1, 0))}
          />
          <ActionButton
            icon={Plus}
            label="Plus 1"
            disabled={!onScale || scaleInProgress}
            onClick={() => onScale?.(desired + 1)}
          />
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
            { label: 'Strategy', value: strategy },
            { label: 'Revision', value: revision || '—', mono: true },
            { label: 'Age', value: formatAge(resource.creationTimestamp) },
            { label: 'Containers', value: images.length || '—' },
          ]}
        />
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {images.slice(0, 3).map((img: string) => (
              <Badge key={img} label={img} />
            ))}
            {images.length > 3 && <Badge label={`+${images.length - 3} more`} tone="info" />}
          </div>
        )}
      </SidebarSection>
    </div>
  );
};
