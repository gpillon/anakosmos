import React, { useState } from 'react';
import type { ClusterResource } from '../../../../api/types';
import type { V1CronJob } from '../../../../api/k8s-types';
import {
  Card, CardHeader, CardBody, MetaRow, MetadataCard, LabelsCard, AnnotationsCard,
  StatusBanner, formatAge, OwnedResourcesCard,
} from '../../shared';
import type { HealthStatus } from '../../shared';
import { Play, Pause, Calendar, Settings, Edit2, Check, X } from 'lucide-react';
import { clsx } from 'clsx';

interface CronJobOverviewProps {
  resource: ClusterResource;
  model: V1CronJob;
  updateModel: (updater: (current: V1CronJob) => V1CronJob) => void;
}

export const CronJobOverview: React.FC<CronJobOverviewProps> = ({ resource, model, updateModel }) => {
  const spec = model.spec;
  const status = model.status;

  // Local UI editing states
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [localSchedule, setLocalSchedule] = useState(spec?.schedule || '');

  // Status
  const suspended = spec?.suspend === true;
  const healthStatus: HealthStatus = suspended ? 'warning' : 'healthy';
  const statusText = suspended ? 'Suspended' : 'Active';

  // Last scheduled time
  const lastScheduleTime = status?.lastScheduleTime;
  const lastSuccessfulTime = status?.lastSuccessfulTime;
  const activeJobs = status?.active || [];

  // Parse cron expression for display
  const schedule = spec?.schedule || '';
  let cronDescription = schedule;
  const cronParts = schedule.split(' ');
  if (cronParts.length === 5) {
    // Simple descriptions for common patterns
    if (schedule === '*/1 * * * *' || schedule === '* * * * *') cronDescription = 'Every minute';
    else if (schedule === '0 * * * *') cronDescription = 'Every hour';
    else if (schedule === '0 0 * * *') cronDescription = 'Daily at midnight';
    else if (schedule === '0 0 * * 0') cronDescription = 'Weekly on Sunday';
    else cronDescription = `${schedule}`;
  }

  const handleSaveSchedule = () => {
    updateModel(current => ({
      ...current,
      spec: {
        ...current.spec!,
        schedule: localSchedule
      }
    }));
    setIsEditingSchedule(false);
  };

  const handleToggleSuspend = () => {
    updateModel(current => ({
      ...current,
      spec: {
        ...current.spec!,
        suspend: !current.spec?.suspend
      }
    }));
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <StatusBanner 
        name={resource.name}
        namespace={resource.namespace}
        health={healthStatus} 
        statusText={statusText}
      >
        {suspended && <p>This CronJob is suspended and will not create new Jobs.</p>}
        {!suspended && <p>Schedule: {cronDescription}</p>}
      </StatusBanner>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleToggleSuspend}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg border font-medium transition-colors",
            suspended
              ? "bg-emerald-900/30 hover:bg-emerald-900/50 border-emerald-700/50 text-emerald-400"
              : "bg-amber-900/30 hover:bg-amber-900/50 border-amber-700/50 text-amber-400"
          )}
        >
          {suspended ? <Play size={16} /> : <Pause size={16} />}
          {suspended ? 'Resume' : 'Suspend'}
        </button>
      </div>

      {/* Schedule Configuration */}
      <Card>
        <CardHeader 
          title="Schedule" 
          icon={<Calendar size={16} />}
          action={
            !isEditingSchedule ? (
              <button 
                onClick={() => setIsEditingSchedule(true)}
                className="text-blue-400 hover:text-blue-300 p-1"
              >
                <Edit2 size={14} />
              </button>
            ) : null
          }
        />
        <CardBody>
          {isEditingSchedule ? (
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={localSchedule}
                onChange={(e) => setLocalSchedule(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                placeholder="*/5 * * * *"
              />
              <button
                onClick={handleSaveSchedule}
                className="p-2 bg-emerald-600 hover:bg-emerald-500 rounded text-white"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => {
                  setLocalSchedule(spec?.schedule || '');
                  setIsEditingSchedule(false);
                }}
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-slate-300"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <code className="bg-slate-800 px-3 py-2 rounded text-cyan-400 font-mono text-lg">
                {spec?.schedule}
              </code>
              <span className="text-slate-400">→</span>
              <span className="text-slate-300">{cronDescription}</span>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Job History Summary */}
      <Card>
        <CardHeader title="Job History Info" icon={<Calendar size={16} />} />
        <CardBody>
          <div className="grid grid-cols-2 gap-4">
            <MetaRow label="Last Scheduled" value={lastScheduleTime ? formatAge(String(lastScheduleTime)) + ' ago' : '-'} />
            <MetaRow label="Last Successful" value={lastSuccessfulTime ? formatAge(String(lastSuccessfulTime)) + ' ago' : '-'} />
            <MetaRow label="Active Jobs" value={String(activeJobs.length)} />
            <MetaRow label="Successful Jobs Limit" value={String(spec?.successfulJobsHistoryLimit ?? 3)} />
            <MetaRow label="Failed Jobs Limit" value={String(spec?.failedJobsHistoryLimit ?? 1)} />
          </div>
        </CardBody>
      </Card>

      {/* Owned Jobs - Generic Component */}
      <OwnedResourcesCard 
        resourceUid={model.metadata?.uid}
        filterKinds={['Job']}
        title="Jobs"
        groupByKind={false}
        maxPerKind={20}
      />

      {/* CronJob Settings */}
      <Card>
        <CardHeader title="Configuration" icon={<Settings size={16} />} />
        <CardBody>
          <div className="grid grid-cols-2 gap-4">
            <MetaRow label="Concurrency Policy" value={spec?.concurrencyPolicy || 'Allow'} />
            <MetaRow label="Starting Deadline (sec)" value={spec?.startingDeadlineSeconds ? String(spec.startingDeadlineSeconds) : '-'} />
            <MetaRow label="Suspend" value={spec?.suspend ? 'Yes' : 'No'} />
            <MetaRow label="Time Zone" value={spec?.timeZone || 'Server Local'} />
          </div>
        </CardBody>
      </Card>

      {/* Metadata */}
      <MetadataCard metadata={model.metadata} />

      {/* Labels */}
      <LabelsCard 
        labels={model.metadata?.labels} 
        editable
        onAdd={(key, value) => {
          updateModel(current => ({
            ...current,
            metadata: {
              ...current.metadata,
              labels: {
                ...current.metadata?.labels,
                [key]: value
              }
            }
          }));
        }}
        onRemove={(key) => {
          updateModel(current => {
            const newLabels = { ...current.metadata?.labels };
            delete newLabels[key];
            return {
              ...current,
              metadata: {
                ...current.metadata,
                labels: newLabels
              }
            };
          });
        }}
      />

      {/* Annotations */}
      <AnnotationsCard 
        annotations={model.metadata?.annotations}
        editable
        onAdd={(key, value) => {
          updateModel(current => ({
            ...current,
            metadata: {
              ...current.metadata,
              annotations: {
                ...current.metadata?.annotations,
                [key]: value
              }
            }
          }));
        }}
        onRemove={(key) => {
          updateModel(current => {
            const newAnnotations = { ...current.metadata?.annotations };
            delete newAnnotations[key];
            return {
              ...current,
              metadata: {
                ...current.metadata,
                annotations: newAnnotations
              }
            };
          });
        }}
      />
    </div>
  );
};
