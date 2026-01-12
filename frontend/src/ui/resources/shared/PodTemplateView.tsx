import React from 'react';
import type { V1PodTemplateSpec, V1PodStatus } from '../../../api/k8s-types';
import { ContainerList } from './ContainerList';
import { LabelsCard } from './LabelsCard';
import { AnnotationsCard } from './AnnotationsCard';

interface PodTemplateViewProps {
  template: V1PodTemplateSpec | undefined;
  podStatus?: V1PodStatus; // For showing actual pod status (in Pod view)
  editable?: boolean;
  onUpdateContainer?: (index: number, updates: any, isInit: boolean) => void;
  showLabels?: boolean;
  showAnnotations?: boolean;
}

/**
 * Reusable component for displaying PodTemplateSpec
 * Used by Deployment, StatefulSet, DaemonSet, Job, etc.
 */
export const PodTemplateView: React.FC<PodTemplateViewProps> = ({ 
  template,
  podStatus,
  editable = false,
  onUpdateContainer,
  showLabels = false,
  showAnnotations = false
}) => {
  if (!template) return null;

  const spec = template.spec;
  const metadata = template.metadata;

  return (
    <div className="space-y-6">
      {/* Containers */}
      <ContainerList
        containers={spec?.containers}
        initContainers={spec?.initContainers}
        containerStatuses={podStatus?.containerStatuses}
        initContainerStatuses={podStatus?.initContainerStatuses}
        editable={editable}
        onUpdateContainer={onUpdateContainer}
      />

      {/* Pod Template Labels */}
      {showLabels && metadata?.labels && Object.keys(metadata.labels).length > 0 && (
        <LabelsCard 
          labels={metadata.labels}
          editable={false}
        />
      )}

      {/* Pod Template Annotations */}
      {showAnnotations && metadata?.annotations && Object.keys(metadata.annotations).length > 0 && (
        <AnnotationsCard 
          annotations={metadata.annotations}
          editable={false}
        />
      )}
    </div>
  );
};
