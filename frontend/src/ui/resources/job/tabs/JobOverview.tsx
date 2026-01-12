import React from 'react';
import type { ClusterResource } from '../../../../api/types';
import type { V1Job, V1JobCondition } from '../../../../api/k8s-types';
import {
  Card, CardHeader, CardBody, MetaRow, MetadataCard, LabelsCard, AnnotationsCard,
  ConditionsCard, StatusBanner, formatDate, OwnerReferencesCard, OwnedResourcesCard,
} from '../../shared';
import type { HealthStatus } from '../../shared';
import { Layers } from 'lucide-react';

interface JobOverviewProps {
  resource: ClusterResource;
  job: V1Job;
  onApply: (job: V1Job) => Promise<void>;
}

export const JobOverview: React.FC<JobOverviewProps> = ({ resource, job, onApply }) => {
  const spec = job.spec;
  const status = job.status;

  // Determine job status
  const conditions = (status?.conditions || []) as V1JobCondition[];
  const completeCond = conditions.find(c => c.type === 'Complete' && c.status === 'True');
  const failedCond = conditions.find(c => c.type === 'Failed' && c.status === 'True');
  // Check for any warning/error conditions (like FailedCreate, BackoffLimitExceeded)
  const warningCond = conditions.find(c => 
    c.status === 'True' && 
    (c.type?.includes('Failed') || c.reason?.includes('Failed') || c.reason?.includes('Error') || c.reason?.includes('BackoffLimit'))
  );
  
  let healthStatus: HealthStatus = 'unknown';
  let statusText = 'Running';
  let statusDetail = '';
  
  if (completeCond) {
    healthStatus = 'healthy';
    statusText = 'Complete';
  } else if (failedCond) {
    healthStatus = 'error';
    statusText = 'Failed';
    statusDetail = failedCond.reason || '';
  } else if (warningCond) {
    healthStatus = 'error';
    statusText = 'Failed';
    statusDetail = warningCond.reason || warningCond.type || '';
  } else if ((status?.active || 0) > 0) {
    healthStatus = 'unknown';
    statusText = 'Running';
  } else if ((status?.succeeded || 0) > 0) {
    healthStatus = 'healthy';
    statusText = 'Complete';
  } else {
    healthStatus = 'warning';
    statusText = 'Pending';
  }

  // Stats
  const succeeded = status?.succeeded || 0;
  const failed = status?.failed || 0;
  const active = status?.active || 0;
  const completions = spec?.completions ?? 1;
  const parallelism = spec?.parallelism ?? 1;

  // Duration
  const startTime = status?.startTime;
  const completionTime = status?.completionTime;
  let duration = '';
  if (startTime) {
    const start = new Date(startTime).getTime();
    const end = completionTime ? new Date(completionTime).getTime() : Date.now();
    const durationMs = end - start;
    const secs = Math.floor(durationMs / 1000);
    if (secs < 60) duration = `${secs}s`;
    else if (secs < 3600) duration = `${Math.floor(secs / 60)}m ${secs % 60}s`;
    else duration = `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  }

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <StatusBanner 
        name={resource.name}
        namespace={resource.namespace}
        health={healthStatus} 
        statusText={statusDetail ? `${statusText} (${statusDetail})` : statusText}
      >
        {completeCond && completeCond.message && <p>{completeCond.message}</p>}
        {failedCond && failedCond.message && <p className="text-red-400">{failedCond.message}</p>}
        {warningCond && warningCond.message && !failedCond && (
          <p className="text-red-400">{warningCond.message}</p>
        )}
      </StatusBanner>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{succeeded}</div>
          <div className="text-xs text-slate-500">Succeeded</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{failed}</div>
          <div className="text-xs text-slate-500">Failed</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{active}</div>
          <div className="text-xs text-slate-500">Active</div>
        </div>
        <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 text-center">
          <div className="text-2xl font-bold text-slate-300">{completions}</div>
          <div className="text-xs text-slate-500">Target Completions</div>
        </div>
      </div>

      {/* Job Config */}
      <Card>
        <CardHeader title="Job Configuration" icon={<Layers size={16} />} />
        <CardBody>
          <div className="grid grid-cols-2 gap-4">
            <MetaRow label="Completions" value={String(completions)} />
            <MetaRow label="Parallelism" value={String(parallelism)} />
            <MetaRow label="Backoff Limit" value={String(spec?.backoffLimit ?? 6)} />
            <MetaRow label="Active Deadline" value={spec?.activeDeadlineSeconds ? `${spec.activeDeadlineSeconds}s` : '-'} />
            <MetaRow label="TTL After Finished" value={spec?.ttlSecondsAfterFinished ? `${spec.ttlSecondsAfterFinished}s` : '-'} />
            <MetaRow label="Completion Mode" value={spec?.completionMode || 'NonIndexed'} />
            {startTime && <MetaRow label="Started" value={formatDate(String(startTime))} />}
            {completionTime && <MetaRow label="Completed" value={formatDate(String(completionTime))} />}
            {duration && <MetaRow label="Duration" value={duration} />}
          </div>
        </CardBody>
      </Card>

      {/* Owner (e.g., CronJob) */}
      <OwnerReferencesCard 
        ownerReferences={job.metadata?.ownerReferences}
        showFullChain
      />

      {/* Owned Pods */}
      <OwnedResourcesCard 
        resourceUid={job.metadata?.uid}
        filterKinds={['Pod']}
        title="Pods"
        groupByKind={false}
      />

      {/* Metadata */}
      <MetadataCard metadata={job.metadata} />

      {/* Labels */}
      <LabelsCard 
        labels={job.metadata?.labels} 
        editable
        onAdd={async (key, value) => {
          const updated = { ...job };
          updated.metadata = { ...updated.metadata, labels: { ...updated.metadata?.labels, [key]: value } };
          await onApply(updated);
        }}
        onRemove={async (key) => {
          const updated = { ...job };
          const newLabels = { ...updated.metadata?.labels };
          delete newLabels[key];
          updated.metadata = { ...updated.metadata, labels: newLabels };
          await onApply(updated);
        }}
      />

      {/* Annotations */}
      <AnnotationsCard 
        annotations={job.metadata?.annotations} 
        editable
        onAdd={async (key, value) => {
          const updated = { ...job };
          updated.metadata = { ...updated.metadata, annotations: { ...updated.metadata?.annotations, [key]: value } };
          await onApply(updated);
        }}
        onRemove={async (key) => {
          const updated = { ...job };
          const newAnnotations = { ...updated.metadata?.annotations };
          delete newAnnotations[key];
          updated.metadata = { ...updated.metadata, annotations: newAnnotations };
          await onApply(updated);
        }}
      />

      {/* Conditions */}
      {conditions.length > 0 && (
        <ConditionsCard 
          conditions={conditions.map(c => ({
            type: c.type || '',
            status: c.status || '',
            reason: c.reason,
            message: c.message,
            lastTransitionTime: c.lastTransitionTime ? String(c.lastTransitionTime) : undefined,
          }))} 
        />
      )}
    </div>
  );
};
