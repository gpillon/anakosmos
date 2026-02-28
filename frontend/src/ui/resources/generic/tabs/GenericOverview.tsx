import React, { useMemo } from 'react';
import type { ClusterResource } from '../../../../api/types';
import {
  Card, CardHeader, CardBody, MetaRow, MetadataCard, LabelsCard, AnnotationsCard,
  ConditionsCard, StatusBanner, OwnerReferencesCard, OwnedResourcesCard, formatAge,
} from '../../shared';
import type { HealthStatus } from '../../shared';
import { 
  Info, Box, FileJson
} from 'lucide-react';
import { clsx } from 'clsx';
import { KIND_CONFIG } from '../../../../config/resourceKinds';

interface GenericOverviewProps {
  resource: ClusterResource;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawData?: any;
  onApply: (data: Record<string, unknown>) => Promise<void>;
}

// Icon mapping - module-level lookup to avoid creating components during render
const KIND_ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = Object.fromEntries(
  KIND_CONFIG.map((k) => [k.kind, k.icon])
);

// Determine health status from resource
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const determineHealthStatus = (resource: ClusterResource, rawData: any): { health: HealthStatus; statusText: string } => {
  const status = resource.status;
  
  // Check conditions if present
  const conditions = (rawData?.status as Record<string, unknown> | undefined)?.conditions;
  if (conditions && Array.isArray(conditions)) {
    const conds = conditions as Array<{ type?: string; status?: string; reason?: string }>;
    const readyCond = conds.find((c) => c.type === 'Ready');
    const availableCond = conds.find((c) => c.type === 'Available');
    const failedCond = conds.find((c) => 
      (c.type === 'Failed' || c.type?.includes?.('Error') || c.reason?.includes?.('Failed')) && c.status === 'True'
    );
    
    if (failedCond) return { health: 'error', statusText: failedCond.reason || 'Failed' };
    if (readyCond?.status === 'True') return { health: 'healthy', statusText: 'Ready' };
    if (availableCond?.status === 'True') return { health: 'healthy', statusText: 'Available' };
    if (readyCond?.status === 'False') return { health: 'warning', statusText: readyCond.reason || 'NotReady' };
  }
  
  // Check common status values
  const healthyStatuses = ['Running', 'Ready', 'Active', 'Available', 'Bound', 'Succeeded', 'Complete', 'Healthy'];
  const warningStatuses = ['Pending', 'Terminating', 'Suspended', 'Unknown'];
  const errorStatuses = ['Failed', 'Error', 'CrashLoopBackOff', 'ImagePullBackOff', 'ErrImagePull'];
  
  if (healthyStatuses.includes(status)) return { health: 'healthy', statusText: status };
  if (errorStatuses.includes(status)) return { health: 'error', statusText: status };
  if (warningStatuses.includes(status)) return { health: 'warning', statusText: status };
  
  return { health: 'unknown', statusText: status || 'Unknown' };
};

// Extract important info from spec
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractSpecHighlights = (rawData: any): Array<{ label: string; value: string }> => {
  const highlights: Array<{ label: string; value: string }> = [];
  const spec = rawData?.spec as Record<string, unknown> | undefined;
  
  if (!spec) return highlights;
  
  // Common spec fields
  if (spec.replicas !== undefined) highlights.push({ label: 'Replicas', value: String(spec.replicas) });
  if (spec.selector) {
    const matchLabels = (spec.selector as Record<string, unknown>)?.matchLabels;
    if (matchLabels) {
      highlights.push({ label: 'Selector', value: Object.entries(matchLabels).map(([k, v]) => `${k}=${v}`).join(', ') });
    }
  }
  if (spec.type) highlights.push({ label: 'Type', value: String(spec.type) });
  if (spec.clusterIP) highlights.push({ label: 'Cluster IP', value: String(spec.clusterIP) });
  if (spec.ports && Array.isArray(spec.ports)) {
    highlights.push({ label: 'Ports', value: (spec.ports as Array<{ port?: number; protocol?: string }>).map((p) => `${p.port}/${p.protocol || 'TCP'}`).join(', ') });
  }
  if (spec.schedule) highlights.push({ label: 'Schedule', value: String(spec.schedule) });
  if (spec.suspend !== undefined) highlights.push({ label: 'Suspended', value: spec.suspend ? 'Yes' : 'No' });
  if (spec.completions !== undefined) highlights.push({ label: 'Completions', value: String(spec.completions) });
  if (spec.parallelism !== undefined) highlights.push({ label: 'Parallelism', value: String(spec.parallelism) });
  if (spec.backoffLimit !== undefined) highlights.push({ label: 'Backoff Limit', value: String(spec.backoffLimit) });
  if (spec.minReplicas !== undefined) highlights.push({ label: 'Min Replicas', value: String(spec.minReplicas) });
  if (spec.maxReplicas !== undefined) highlights.push({ label: 'Max Replicas', value: String(spec.maxReplicas) });
  if (spec.storageClassName) highlights.push({ label: 'Storage Class', value: String(spec.storageClassName) });
  if (spec.accessModes) highlights.push({ label: 'Access Modes', value: (spec.accessModes as string[]).join(', ') });
  if ((spec.capacity as Record<string, unknown>)?.storage) highlights.push({ label: 'Capacity', value: String((spec.capacity as Record<string, unknown>).storage) });
  if ((spec.resources as Record<string, unknown>)?.requests) highlights.push({ label: 'Requested Storage', value: String(((spec.resources as Record<string, Record<string, Record<string, unknown>>>).requests as Record<string, unknown>).storage) });
  if (spec.provisioner) highlights.push({ label: 'Provisioner', value: String(spec.provisioner) });
  if (spec.reclaimPolicy) highlights.push({ label: 'Reclaim Policy', value: String(spec.reclaimPolicy) });
  if (spec.volumeBindingMode) highlights.push({ label: 'Volume Binding', value: String(spec.volumeBindingMode) });
  
  return highlights.slice(0, 8); // Limit to 8 items
};

// Extract important info from status
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const extractStatusHighlights = (rawData: any): Array<{ label: string; value: string; isError?: boolean }> => {
  const highlights: Array<{ label: string; value: string; isError?: boolean }> = [];
  const status = rawData?.status as Record<string, unknown> | undefined;
  
  if (!status) return highlights;
  
  // Common status fields
  if (status.phase) highlights.push({ label: 'Phase', value: String(status.phase) });
  if (status.replicas !== undefined) highlights.push({ label: 'Replicas', value: String(status.replicas) });
  if (status.readyReplicas !== undefined) highlights.push({ label: 'Ready', value: String(status.readyReplicas) });
  if (status.availableReplicas !== undefined) highlights.push({ label: 'Available', value: String(status.availableReplicas) });
  if (status.unavailableReplicas) highlights.push({ label: 'Unavailable', value: String(status.unavailableReplicas), isError: true });
  if (status.currentReplicas !== undefined) highlights.push({ label: 'Current', value: String(status.currentReplicas) });
  if (status.desiredReplicas !== undefined) highlights.push({ label: 'Desired', value: String(status.desiredReplicas) });
  if (status.succeeded !== undefined) highlights.push({ label: 'Succeeded', value: String(status.succeeded) });
  if (typeof status.failed === 'number' && status.failed > 0) highlights.push({ label: 'Failed', value: String(status.failed), isError: true });
  if (status.active !== undefined) highlights.push({ label: 'Active', value: String(status.active) });
  if (status.startTime) highlights.push({ label: 'Started', value: formatAge(String(status.startTime)) + ' ago' });
  if (status.completionTime) highlights.push({ label: 'Completed', value: formatAge(String(status.completionTime)) + ' ago' });
  if (status.lastScheduleTime) highlights.push({ label: 'Last Scheduled', value: formatAge(String(status.lastScheduleTime)) + ' ago' });
  if (status.observedGeneration !== undefined) highlights.push({ label: 'Observed Gen', value: String(status.observedGeneration) });
  
  return highlights.slice(0, 8); // Limit to 8 items
};

export const GenericOverview: React.FC<GenericOverviewProps> = ({ resource, rawData, onApply }) => {
  const { health, statusText } = determineHealthStatus(resource, rawData);
  const specHighlights = useMemo(() => extractSpecHighlights(rawData), [rawData]);
  const statusHighlights = useMemo(() => extractStatusHighlights(rawData), [rawData]);

  // Extract conditions
  const conditions = useMemo(() => {
    const conds = (rawData?.status as Record<string, unknown> | undefined)?.conditions;
    if (!conds || !Array.isArray(conds)) return [];
    return (conds as Array<{ type?: string; status?: string; reason?: string; message?: string; lastTransitionTime?: string }>).map((c) => ({
      type: c.type || '',
      status: c.status || '',
      reason: c.reason,
      message: c.message,
      lastTransitionTime: c.lastTransitionTime ? String(c.lastTransitionTime) : undefined,
    }));
  }, [rawData]);

  const KindIcon = KIND_ICON_MAP[resource.kind] ?? Box;

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <StatusBanner 
        name={resource.name}
        namespace={resource.namespace}
        health={health} 
        statusText={statusText}
      >
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <KindIcon size={14} />
          <span>{resource.kind}</span>
          {rawData?.apiVersion && (
            <>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">{rawData.apiVersion}</span>
            </>
          )}
        </div>
      </StatusBanner>

      {/* Quick Stats Grid */}
      {(specHighlights.length > 0 || statusHighlights.length > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statusHighlights.slice(0, 4).map((item, idx) => (
            <div key={`status-${idx}`} className="bg-slate-900/50 rounded-lg border border-slate-800 p-3 text-center">
              <div className={clsx(
                "text-xl font-bold",
                item.isError ? "text-red-400" : "text-emerald-400"
              )}>
                {item.value}
              </div>
              <div className="text-[10px] text-slate-500 uppercase">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Spec Highlights */}
      {specHighlights.length > 0 && (
        <Card>
          <CardHeader title="Configuration" icon={<FileJson size={16} />} />
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              {specHighlights.map((item, idx) => (
                <MetaRow key={idx} label={item.label} value={item.value} />
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Status Details (if more than shown in grid) */}
      {statusHighlights.length > 4 && (
        <Card>
          <CardHeader title="Status Details" icon={<Info size={16} />} />
          <CardBody>
            <div className="grid grid-cols-2 gap-3">
              {statusHighlights.slice(4).map((item, idx) => (
                <div key={idx} className={item.isError ? 'text-red-400' : ''}>
                  <MetaRow label={item.label} value={item.value} />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Owner References - Generic Component with Full Chain */}
      <OwnerReferencesCard 
        ownerReferences={rawData?.metadata?.ownerReferences}
        showFullChain
      />

      {/* Owned Resources - Generic Component */}
      <OwnedResourcesCard 
        resourceUid={rawData?.metadata?.uid}
        groupByKind
        maxPerKind={10}
      />

      {/* Metadata */}
      <MetadataCard metadata={rawData?.metadata} showUid showGeneration showResourceVersion />

      {/* Labels */}
      <LabelsCard 
        labels={rawData?.metadata?.labels}
        editable
        onAdd={async (key, value) => {
          const updated = { ...rawData };
          updated.metadata = { ...updated.metadata, labels: { ...updated.metadata?.labels, [key]: value } };
          await onApply(updated);
        }}
        onRemove={async (key) => {
          const updated = { ...rawData };
          const newLabels = { ...updated.metadata?.labels };
          delete newLabels[key];
          updated.metadata = { ...updated.metadata, labels: newLabels };
          await onApply(updated);
        }}
      />

      {/* Annotations */}
      <AnnotationsCard 
        annotations={rawData?.metadata?.annotations}
        editable
        onAdd={async (key, value) => {
          const updated = { ...rawData };
          updated.metadata = { ...updated.metadata, annotations: { ...updated.metadata?.annotations, [key]: value } };
          await onApply(updated);
        }}
        onRemove={async (key) => {
          const updated = { ...rawData };
          const newAnnotations = { ...updated.metadata?.annotations };
          delete newAnnotations[key];
          updated.metadata = { ...updated.metadata, annotations: newAnnotations };
          await onApply(updated);
        }}
      />

      {/* Conditions */}
      {conditions.length > 0 && (
        <ConditionsCard conditions={conditions} />
      )}
    </div>
  );
};
