import React from 'react';
import type { V1CronJob } from '../../../../api/k8s-types';
import { PodTemplateView, Card, CardHeader, CardBody, MetaRow } from '../../shared';
import { Layers, Settings } from 'lucide-react';

interface CronJobJobTemplateProps {
  cronJob: V1CronJob;
}

export const CronJobJobTemplate: React.FC<CronJobJobTemplateProps> = ({ cronJob }) => {
  const jobTemplate = cronJob.spec?.jobTemplate;
  const jobSpec = jobTemplate?.spec;
  const podTemplate = jobSpec?.template;

  if (!podTemplate) {
    return (
      <div className="text-center text-slate-500 py-8">
        No job template defined
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Job Spec Settings */}
      <Card>
        <CardHeader title="Job Settings" icon={<Settings size={16} />} />
        <CardBody>
          <div className="grid grid-cols-2 gap-4">
            <MetaRow label="Completions" value={String(jobSpec?.completions ?? 1)} />
            <MetaRow label="Parallelism" value={String(jobSpec?.parallelism ?? 1)} />
            <MetaRow label="Backoff Limit" value={String(jobSpec?.backoffLimit ?? 6)} />
            <MetaRow label="Active Deadline (sec)" value={jobSpec?.activeDeadlineSeconds ? String(jobSpec.activeDeadlineSeconds) : '-'} />
            <MetaRow label="TTL After Finished (sec)" value={jobSpec?.ttlSecondsAfterFinished ? String(jobSpec.ttlSecondsAfterFinished) : '-'} />
            <MetaRow label="Completion Mode" value={jobSpec?.completionMode || 'NonIndexed'} />
          </div>
        </CardBody>
      </Card>

      {/* Pod Template */}
      <Card>
        <CardHeader title="Pod Template" icon={<Layers size={16} />} />
        <CardBody className="p-0">
          <PodTemplateView template={podTemplate} />
        </CardBody>
      </Card>
    </div>
  );
};
