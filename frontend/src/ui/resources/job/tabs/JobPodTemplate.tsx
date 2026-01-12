import React from 'react';
import type { V1Job } from '../../../../api/k8s-types';
import { PodTemplateView } from '../../shared';

interface JobPodTemplateProps {
  job: V1Job;
}

export const JobPodTemplate: React.FC<JobPodTemplateProps> = ({ job }) => {
  const template = job.spec?.template;

  if (!template) {
    return (
      <div className="text-center text-slate-500 py-8">
        No pod template defined
      </div>
    );
  }

  return <PodTemplateView template={template} />;
};
